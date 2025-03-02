// Importation des modules nécessaires
const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config(); // Pour charger les variables depuis .env

console.log('Modules importés et variables d\'environnement chargées.');

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

console.log('Client Discord créé avec les permissions nécessaires.');

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log(`Message reçu : ${message.content}`);

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = message.member.permissions.has('ADMINISTRATOR');
  console.log(`L'utilisateur est administrateur : ${isAdmin}`);

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

    console.log(`Arguments extraits : nom=${billeName}, image=${billeImage}, statusOrUser=${statusOrUser}`);

    if (!isValidUrl(billeImage)) {
      return message.reply("L'URL de l'image fournie n'est pas valide.");
    }

    const channel = await client.channels.fetch(1345791307221696563);
    if (!channel) return console.error("Canal de réservation non trouvé");

    console.log(`Canal de réservation trouvé : ${channel.name}`);

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

    console.log(`Message de bille créé : ${billeMessage.id}`);

    message.reply(`Bille ${billeName} créée avec succès.`);
  }
});

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Token chargé : Oui');
}).catch(err => {
  console.error('Erreur lors de la connexion du bot :', err);
});