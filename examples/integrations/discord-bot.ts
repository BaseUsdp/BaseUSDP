/**
 * Discord Bot Integration
 *
 * A simple Discord bot that allows users to send USDC tips via BaseUSDP.
 * Usage: /tip @user 5.00
 */

import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

const discord = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Send a USDC tip via BaseUSDP')
    .addUserOption((option) =>
      option.setName('recipient').setDescription('Who to tip').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('amount').setDescription('Amount in USDC').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('Optional message').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your BaseUSDP tip balance'),
];

discord.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'tip') {
    const recipient = interaction.options.getUser('recipient', true);
    const amount = interaction.options.getString('amount', true);
    const message = interaction.options.getString('message') || '';

    await interaction.deferReply();

    try {
      const payment = await client.payments.create({
        amount,
        currency: 'USDC',
        description: `Discord tip from ${interaction.user.tag} to ${recipient.tag}`,
        metadata: {
          platform: 'discord',
          senderId: interaction.user.id,
          recipientId: recipient.id,
          message,
        },
      });

      await interaction.editReply({
        content: `Tip of ${amount} USDC for ${recipient}!\nPay here: ${payment.url}\n${message ? `Message: "${message}"` : ''}`,
      });
    } catch (error) {
      await interaction.editReply({ content: 'Failed to create tip. Please try again.' });
    }
  }

  if (interaction.commandName === 'balance') {
    await interaction.reply({ content: 'Balance checking coming soon!', ephemeral: true });
  }
});

discord.login(process.env.DISCORD_BOT_TOKEN);
