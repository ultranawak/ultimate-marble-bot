// Importation des modules nécessaires
const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config(); // Pour charger les variables depuis .env

// Création du client du bot avec les permissions nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction],
});

console.log('Bot démarré.');

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

const RESA_CHANNEL_ID = "1345791307221696563"; // ID du canal de réservation

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = message.member.permissions.has('ADMINISTRATOR');

  // Commande pour créer une bille
  if (message.content.startsWith('!create')) {
    if (!isAdmin) {
      await message.delete();
      return message.author.send("Vous n'êtes pas autorisé à utiliser cette commande.");
    }

    const args = message.content.match(/"([^"]+)"\s+(\S+)\s+(libre|\d+)/);
    if (!args) {
      await message.delete();
      return message.author.send("Usage: !create \"<nom_bille>\" <url_image> <libre|user_id>");
    }

    const billeName = args[1];
    const billeImage = args[2];
    const statusOrUserId = args[3];

    if (!isValidUrl(billeImage)) {
      await message.delete();
      return message.author.send("L'URL de l'image fournie n'est pas valide.");
    }

    const channel = await client.channels.fetch(RESA_CHANNEL_ID);
    if (!channel) return console.error("Canal de réservation non trouvé");

    // Vérifier si une bille avec le même nom existe déjà
    const messages = await channel.messages.fetch({ limit: 100 });
    const existingMessage = messages.find(msg => msg.embeds[0]?.title === billeName);

    if (existingMessage) {
      await message.delete();
      return message.author.send(`Une bille avec le nom "${billeName}" existe déjà.`);
    }

    let messageContent;
    let messageEmbed;

    if (statusOrUserId === "libre") {
      messageContent = `Vous pouvez réserver la ${billeName}`;
      messageEmbed = {
        color: 0x0099ff,
        title: billeName,
        description: 'Vous pouvez réserver cette bille.',
        image: {
          url: billeImage,
        },
      };
    } else {
      const guild = message.guild;
      const member = await guild.members.fetch(statusOrUserId);
      if (!member) {
        await message.delete();
        return message.author.send("L'utilisateur mentionné n'est pas valide.");
      }

      const displayName = member.displayName;

      messageContent = `La ${billeName} est réservée par ${displayName}`;
      messageEmbed = {
        color: 0xff0000,
        title: billeName,
        description: `Cette bille est réservée par ${displayName}.`,
        image: {
          url: billeImage,
        },
      };
    }

    const billeMessage = await channel.send({ content: messageContent, embeds: [messageEmbed] });
    await billeMessage.react('👍');

    await message.delete();
    message.author.send(`"${billeName}" créé avec succès.`);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Erreur lors du chargement de la réaction :', error);
      return;
    }
  }

  if (!reaction.message.author.bot || reaction.emoji.name !== '👍' || user.bot) return;

  const billeName = reaction.message.embeds[0]?.title;
  if (!billeName) return;

  const channel = await client.channels.fetch(RESA_CHANNEL_ID);
  if (!channel) return console.error("Canal de réservation non trouvé");

  const messages = await channel.messages.fetch({ limit: 100 });
  const billeMessage = messages.find(msg => msg.embeds[0]?.title === billeName);
  if (!billeMessage) return;

  const billeEmbed = billeMessage.embeds[0];
  const reserverPar = billeEmbed.description.match(/réservée par (.+)\./)?.[1];

  if (reserverPar === user.username) {
    // Annuler la réservation
    await billeMessage.edit({
      content: `Vous pouvez réserver la ${billeName}`,
      embeds: [{
        color: 0x0099ff,
        title: billeName,
        description: 'Vous pouvez réserver cette bille.',
        image: {
          url: billeEmbed.image.url,
        },
      }],
    });
    await user.send(`Votre réservation de la bille "${billeName}" a été annulée.`);
    await reaction.users.remove(user.id);
  } else if (reserverPar && reserverPar !== user.username) {
    // Bille déjà réservée par un autre utilisateur
    await user.send(`Désolé, cette bille est déjà réservée par ${reserverPar}.`);
    await reaction.users.remove(user.id);
  } else if (!reserverPar) {
    // Vérifier si l'utilisateur a déjà une réservation
    const existingReservation = messages.find(msg => msg.embeds[0]?.description.includes(`réservée par ${user.username}`));
    if (existingReservation) {
      const existingBilleName = existingReservation.embeds[0].title;
      await user.send(`Vous avez déjà réservé la bille "${existingBilleName}". Veuillez annuler votre réservation avant d'en choisir une autre.`);
      await reaction.users.remove(user.id);
    } else {
      // Réserver la bille
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id);
      const displayName = member.displayName;

      await billeMessage.edit({
        content: `La ${billeName} est réservée par ${displayName}`,
        embeds: [{
          color: 0xff0000,
          title: billeName,
          description: `Cette bille est réservée par ${displayName}.`,
          image: {
            url: billeEmbed.image.url,
          },
        }],
      });
      await user.send(`Vous avez réservé la bille "${billeName}".`);
      await reaction.users.remove(user.id);
    }
  }
});

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Token chargé : Oui');
}).catch(err => {
  console.error('Erreur lors de la connexion du bot :', err);
});