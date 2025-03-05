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
        description: `Cette bille est réservée par <@${statusOrUserId}>.`,
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

  // Commande pour envoyer le message de demande d'inscription
  if (message.content.startsWith('!inscription')) {
    if (!isAdmin) {
      await message.delete();
      return message.author.send("Vous n'êtes pas autorisé à utiliser cette commande.");
    }

    const inscriptionMessage = await message.channel.send("Réagissez à ce message pour faire une demande d'inscription.");
    await inscriptionMessage.react('✅'); // Ajoutez une réaction de check

    await message.delete();
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

  if (user.bot) return;

  const message = reaction.message;

  // Vérifiez si la réaction est sur le message de demande d'inscription
  if (message.content === "Réagissez à ce message pour faire une demande d'inscription." && reaction.emoji.name === '✅') {
    // Envoyer un MP à l'utilisateur
    await user.send(`Votre demande d'inscription a bien été enregistrée et un administrateur validera votre inscription sous peu.\nN'oubliez pas de vous affranchir des frais d'inscription de 5$ par virement Interac au **438-530-7386**.`);

    // Envoyer un MP à l'administrateur
    const adminId = '232244521998614528'; // Remplacez par l'ID de l'administrateur
    try {
      const admin = await client.users.fetch(adminId);
      const member = await reaction.message.guild.members.fetch(user.id);
      const displayName = member.displayName;
      await admin.send(`Nouvelle demande d'inscription de ${displayName} (${user.id}).`);
      console.log(`Message envoyé à l'administrateur ${admin.username}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message à l\'administrateur :', error);
    }

    return;
  }

  // ... (code existant pour la gestion des réactions sur les billes)
  const billeName = reaction.message.embeds[0]?.title;
  if (!billeName) return;

  const channel = await client.channels.fetch(RESA_CHANNEL_ID);
  if (!channel) return console.error("Canal de réservation non trouvé");

  const messages = await channel.messages.fetch({ limit: 100 });
  const billeMessage = messages.find(msg => msg.embeds[0]?.title === billeName);
  if (!billeMessage) return;

  const billeEmbed = billeMessage.embeds[0];
  const reserverParMatch = billeEmbed.description.match(/réservée par <@(\d+)>/);
  const reserverParId = reserverParMatch ? reserverParMatch[1] : null;

  if (reserverParId === user.id) {
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
  } else if (reserverParId && reserverParId !== user.id) {
    // Bille déjà réservée par un autre utilisateur
    const reserverParMember = await reaction.message.guild.members.fetch(reserverParId);
    const reserverParDisplayName = reserverParMember ? reserverParMember.displayName : reserverParId;
    await user.send(`Désolé, cette bille est déjà réservée par ${reserverParDisplayName}.`);
    await reaction.users.remove(user.id);
  } else if (!reserverParId) {
    // Vérifier si l'utilisateur a déjà une réservation
    const existingReservation = messages.find(msg => msg.embeds[0]?.description.includes(`réservée par <@${user.id}>`));
    if (existingReservation) {
      const existingBilleName = existingReservation.embeds[0].title;
      const existingMessageId = existingReservation.id;
      const existingMessageLink = `https://discord.com/channels/${channel.guild.id}/${channel.id}/${existingMessageId}`;
      await user.send(`Vous avez déjà réservé la bille "${existingBilleName}". Veuillez annuler votre réservation [ici](${existingMessageLink}) avant d'en choisir une autre.`);
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
          description: `Cette bille est réservée par <@${user.id}>.`,
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