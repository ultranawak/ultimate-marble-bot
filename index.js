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
      return message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
    }

    const args = message.content.match(/"([^"]+)"\s+(\S+)\s+(libre|<@\d+>)/);
    if (!args) {
      return message.reply("Usage: !create \"<nom_bille>\" <url_image> <libre|@user>");
    }

    const billeName = args[1];
    const billeImage = args[2];
    const statusOrUser = args[3];

    if (!isValidUrl(billeImage)) {
      return message.reply("L'URL de l'image fournie n'est pas valide.");
    }

    const channel = await client.channels.fetch(RESA_CHANNEL_ID);
    if (!channel) return console.error("Canal de réservation non trouvé");

    // Vérifier si une bille avec le même nom existe déjà
    const messages = await channel.messages.fetch({ limit: 100 });
    const existingMessage = messages.find(msg => msg.embeds[0]?.title === billeName);

    if (existingMessage) {
      return message.author.send(`Une bille avec le nom "${billeName}" existe déjà.`);
    }

    let messageContent;
    let messageEmbed;

    if (statusOrUser === "libre") {
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
      const user = message.mentions.users.first();
      if (!user) {
        return message.reply("L'utilisateur mentionné n'est pas valide.");
      }

      messageContent = `La ${billeName} est réservée par ${user}`;
      messageEmbed = {
        color: 0xff0000,
        title: billeName,
        description: `Cette bille est réservée par ${user}.`,
        image: {
          url: billeImage,
        },
      };
    }

    const billeMessage = await channel.send({ content: messageContent, embeds: [messageEmbed] });
    await billeMessage.react('👍');

    message.author.send(`"${billeName}" créé avec succès.`);
  }
});

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Token chargé : Oui');
}).catch(err => {
  console.error('Erreur lors de la connexion du bot :', err);
});