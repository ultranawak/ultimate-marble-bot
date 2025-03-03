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

const billes = new Map(); // Stocke les informations des billes

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log(`Message reçu : ${message.content}`);

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = message.member.permissions.has('ADMINISTRATOR');
  console.log(`L'utilisateur est administrateur : ${isAdmin}`);

  // Commande pour créer une bille
  if (message.content.startsWith('!create')) {
    if (!isAdmin) {
      await message.delete();
      return message.author.send("Vous n'êtes pas autorisé à utiliser cette commande.").catch(console.error);
    }

    const args = message.content.match(/"([^"]+)"\s+(\S+)\s+(libre|\d+)/);
    if (!args) {
      await message.delete();
      return message.author.send("Usage: !create \"<nom_bille>\" <url_image> <libre|user_id>").catch(console.error);
    }

    const billeName = args[1];
    const billeImage = args[2];
    const statusOrUserId = args[3];

    console.log(`Arguments extraits : nom=${billeName}, image=${billeImage}, statusOrUser=${statusOrUserId}`);

    if (!isValidUrl(billeImage)) {
      await message.delete();
      return message.author.send("L'URL de l'image fournie n'est pas valide.").catch(console.error);
    }

    const channel = await client.channels.fetch(RESA_CHANNEL_ID);
    if (!channel) return console.error("Canal de réservation non trouvé");

    console.log(`Canal de réservation trouvé : ${channel.name}`);

    // Vérifier si une bille avec le même nom existe déjà
    const messages = await channel.messages.fetch({ limit: 100 });
    const existingMessage = messages.find(msg => msg.embeds[0]?.title === billeName);

    if (existingMessage) {
      await message.delete();
      return message.author.send(`Une bille avec le nom "${billeName}" existe déjà.`).catch(console.error);
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
      billes.set(billeName, { reserved: false, reserverPar: null, messageId: null });
      console.log(`Bille ajoutée à la liste : ${billeName}`);
    } else {
      const user = await client.users.fetch(statusOrUserId);
      if (!user) {
        await message.delete();
        return message.author.send("L'utilisateur mentionné n'est pas valide.").catch(console.error);
      }

      messageContent = `La ${billeName} est réservée par ${user.username}`;
      messageEmbed = {
        color: 0xff0000,
        title: billeName,
        description: `Cette bille est réservée par ${user.username}.`,
        image: {
          url: billeImage,
        },
      };
      billes.set(billeName, { reserved: true, reserverPar: user.id, messageId: null });
      console.log(`Bille ajoutée à la liste : ${billeName}`);
    }

    const billeMessage = await channel.send({ content: messageContent, embeds: [messageEmbed] });
    await billeMessage.react('👍'); // Ajout de la réaction de pouce jaune

    billes.get(billeName).messageId = billeMessage.id;

    await message.delete();
    message.author.send(`"${billeName}" créé avec succès.`).catch(console.error);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  console.log(`Réaction ajoutée par ${user.username} : ${reaction.emoji.name}`);

  // Assurez-vous que le message est complètement chargé
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Erreur lors du chargement de la réaction :', error);
      return;
    }
  }

  console.log(`Auteur du message : ${reaction.message.author ? reaction.message.author.username : 'null'}`);
  console.log(`Est-ce un bot ? : ${reaction.message.author ? reaction.message.author.bot : 'null'}`);

  if (!reaction.message.author || !reaction.message.author.bot || reaction.emoji.name !== '👍') {
    console.log('Réaction ignorée.');
    return;
  }

  console.log(`Réaction valide détectée sur le message : ${reaction.message.id}`);

  const billeName = reaction.message.embeds[0]?.title;
  if (!billeName) {
    console.log('Nom de la bille non trouvé.');
    return;
  }

  const bille = billes.get(billeName);
  if (!bille) {
    console.log('Bille non trouvée dans la liste.');
    return;
  }

  const channel = await client.channels.fetch(RESA_CHANNEL_ID);
  if (!channel) return console.error("Canal de réservation non trouvé");

  if (bille.reserved && bille.reserverPar === user.id) {
    // Annuler la réservation
    console.log(`Annulation de la réservation de la bille : ${billeName}`);
    bille.reserved = false;
    bille.reserverPar = null;
    await reaction.message.edit({
      content: `Vous pouvez réserver la ${billeName}`,
      embeds: [{
        color: 0x0099ff,
        title: billeName,
        description: 'Vous pouvez réserver cette bille.',
        image: {
          url: reaction.message.embeds[0].image.url,
        },
      }],
    });
    await user.send(`Votre réservation de la bille "${billeName}" a été annulée.`).catch(console.error);
    await reaction.users.remove(user.id);
  } else if (bille.reserved && bille.reserverPar !== user.id) {
    // Bille déjà réservée par un autre utilisateur
    console.log(`Bille déjà réservée par un autre utilisateur : ${billeName}`);
    const reserverUser = await client.users.fetch(bille.reserverPar);
    await user.send(`Désolé, cette bille est déjà réservée par ${reserverUser.username}.`).catch(console.error);
    await reaction.users.remove(user.id);
  } else if (!bille.reserved) {
    // Vérifier si l'utilisateur a déjà une réservation
    console.log(`Vérification des réservations existantes pour l'utilisateur : ${user.username}`);
    const existingReservation = Array.from(billes.values()).find(b => b.reserverPar === user.id);
    if (existingReservation) {
      console.log(`L'utilisateur a déjà une réservation : ${existingReservation.billeName}`);
      await user.send(`Vous avez déjà réservé la bille "${existingReservation.billeName}". Veuillez annuler votre réservation avant d'en choisir une autre.`).catch(console.error);
      await reaction.users.remove(user.id);
    } else {
      // Réserver la bille
      console.log(`Réservation de la bille : ${billeName} par ${user.username}`);
      bille.reserved = true;
      bille.reserverPar = user.id;
      await reaction.message.edit({
        content: `La ${billeName} est réservée par ${user.username}`,
        embeds: [{
          color: 0xff0000,
          title: billeName,
          description: `Cette bille est réservée par ${user.username}.`,
          image: {
            url: reaction.message.embeds[0].image.url,
          },
        }],
      });
      await user.send(`Vous avez réservé la bille "${billeName}".`).catch(console.error);
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