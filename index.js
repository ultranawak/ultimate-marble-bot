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


// ...existing code...

const RESA_CHANNEL_ID = "1345791307221696563"; // ID du salon de réservation

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = message.member.permissions.has('ADMINISTRATOR');

  // Commande pour créer une bille
  if (message.content.startsWith('!create')) {
    if (!isAdmin) {
      return message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
    }

    const args = message.content.split(' ');
    const billeName = args[1];
    const billeImage = args[2]; // URL de l'image

    if (!billeName || !billeImage) {
      return message.reply("Usage: !create <nom_bille> <url_image>");
    }

    const channel = await client.channels.fetch(RESA_CHANNEL_ID);
    if (!channel) return console.error("Canal de réservation non trouvé");

    const messageContent = `Nom: ${billeName}\nStatus: Libre`;
    const messageEmbed = {
      color: 0x0099ff,
      title: billeName,
      description: 'Status: Libre',
      image: {
        url: billeImage,
      },
    };

    const billeMessage = await channel.send({ content: messageContent, embeds: [messageEmbed] });
    await billeMessage.react('👍');

    billes[billeName] = {
      reserved: false,
      reserverPar: null,
      messageId: billeMessage.id,
      image: billeImage,
    };

    message.reply(`Bille ${billeName} créée avec succès.`);
  }

  // Commande pour supprimer une bille
  if (message.content.startsWith('!delete')) {
    if (!isAdmin) {
      return message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
    }

    const args = message.content.split(' ');
    const billeId = args[1];

    if (!billeId) {
      return message.reply("Usage: !delete <id_bille>");
    }

    const bille = Object.keys(billes).find(b => billes[b].messageId === billeId);
    if (!bille) {
      return message.reply("Bille non trouvée.");
    }

    const channel = await client.channels.fetch(RESA_CHANNEL_ID);
    if (!channel) return console.error("Canal de réservation non trouvé");

    const billeMessage = await channel.messages.fetch(billes[bille].messageId);
    if (billeMessage) {
      await billeMessage.delete();
    }

    delete billes[bille];
    message.reply(`Bille ${bille} supprimée avec succès.`);
  }
});

// ...existing code...


// Liste des billes disponibles
const billes = {
  "Bille 1": { reserved: false, reserverPar: null, messageId: null },
  "Bille 2": { reserved: false, reserverPar: null, messageId: null },
  "Bille 3": { reserved: false, reserverPar: null, messageId: null },
  "Bille 4": { reserved: false, reserverPar: null, messageId: null },
  "Bille 5": { reserved: false, reserverPar: null, messageId: null },
};

const reservations = new Map(); // Stocke les réservations par utilisateur
const CHANNEL_ID = "1345262949605834762"; // Remplacez par l'ID du canal où afficher la liste
const WELCOME_CHANNEL_ID = "1345262832593272926"; // ID du canal d'accueil
const ROLE_NAME = "inscrit"; // Nom du rôle à attribuer

// Affichage initial des billes
async function afficherBilles() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return console.error("Canal non trouvé");
  
  for (let bille in billes) {
    console.log(bille);
    if (billes[bille].messageId) {
      // Si le message existe déjà (messageId défini), on passe à la bille suivante
      continue;
    }
    else {
      const message = await channel.send(`Réservez maintenant : ${bille}`);
      await message.react('👍');
      billes[bille].messageId = message.id;
    }
  }
}

// Envoi du message de rôle dans le canal d'accueil
async function envoyerMessageRole() {
  const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
  if (!channel) return console.error("Canal d'accueil non trouvé");

  const message = await channel.send("Réagissez avec ✅ pour recevoir le rôle 'inscrit'");
  await message.react('✅');
  await message.pin(); // Épingler le message
}

client.once('ready', async () => {
  console.log('Le bot est connecté et prêt à recevoir des commandes !');
  await afficherBilles();
  await envoyerMessageRole();
});

// Gestion des réactions ajoutées (réservation)
client.on('messageReactionAdd', async (reaction, user) => {
  if (!reaction.message.author.bot || user.bot) return;

  if (reaction.emoji.name === '✅' && reaction.message.channelId === WELCOME_CHANNEL_ID) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (role && member) {
      await member.roles.add(role);
      user.send("Vous avez reçu le rôle 'inscrit' !");
    }
  }

  if (reaction.emoji.name === '👍') {
    const billeToReserve = reaction.message.content.match(/\bBille \d+\b/);
    console.log(billeToReserve, 'maxime aime les chouettes un truc comme ça');

    if (billes[billeToReserve]) {
      console.log(reservations.has(user.username) + ' bille déja réservée par', user.name);

      if (billes[billeToReserve].reserved) {
        user.send(`Désolé, ${billeToReserve} est déjà réservée par ${billes[billeToReserve].reserverPar}.`).then(() => {
          console.log(`Message envoyé à ${user.username} pour une bille déjà réservée.`);
        }).catch(console.error);

        setTimeout(() => {
          reaction.users.remove(user).then(() => {
            console.log(`Réaction de ${user.username} supprimée.`);
          }).catch(err => {
            console.error(`Erreur lors de la suppression de la réaction de ${user.username}:`, err);
          });
        }, 500);
      } else if (reservations.has(user.username)) {
        user.send(`Vous avez déjà réservé une bille : ${reservations.get(user.username)}. Annulez-la avant d'en réserver une autre.`);
        setTimeout(() => {
          reaction.users.remove(user).catch(console.error);
        }, 500);
      } else {
        billes[billeToReserve].reserved = true;
        billes[billeToReserve].reserverPar = user.username;
        reservations.set(user.username, billeToReserve);
        await reaction.message.edit(`~~Réservez maintenant : ${billeToReserve}~~ (Réservée par ${user.username})`);
        user.send(`Vous avez réservé : ${billeToReserve}`);
      }
    }
  }
});

// Gestion des réactions supprimées (annulation de réservation)
client.on('messageReactionRemove', async (reaction, user) => {
  if (!reaction.message.author.bot || user.bot) return;

  if (reaction.emoji.name === '✅' && reaction.message.channelId === WELCOME_CHANNEL_ID) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (role && member) {
      await member.roles.remove(role);
      user.send("Votre rôle 'inscrit' a été retiré.");
    }
  }

  if (reaction.emoji.name === '👍') {
    const billeToUnreserve = reaction.message.content.replace('~~Réservez maintenant : ', '').replace('~~ (Réservée par ' + user.username + ')', '').trim();

    if (billes[billeToUnreserve] && billes[billeToUnreserve].reserved && billes[billeToUnreserve].reserverPar === user.username) {
      billes[billeToUnreserve].reserved = false;
      billes[billeToUnreserve].reserverPar = null;
      reservations.delete(user.username);
      await reaction.message.edit(`Réservez maintenant : ${billeToUnreserve}`);
      user.send(`Votre réservation de ${billeToUnreserve} a été annulée.`);
    }
  }
});

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Token chargé : Oui');
});
