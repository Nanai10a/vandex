const VERSION = "0.1.0";

import * as mutex from "npm:async-mutex";

const loadEnvs = () => {
  const env: Record<string, unknown> = {};

  const keys = [
    { key: "BOT_TOKEN", optional: false, fn: String },
    { key: "CATEGORY_ID", optional: false, fn: BigInt },
    { key: "DB_PATH", optional: false, fn: String },
    { key: "GUILD_ID", optional: false, fn: BigInt },
  ];

  const none = [];
  for (const { key, optional, fn } of keys) {
    const value = Deno.env.get(key);

    if (!value && !optional) {
      none.push(key);
    }

    if (!value) {
      continue;
    }

    env[key] = fn(value);
  }

  if (none.length !== 0) throw Error(`required environment values, ${none}`);

  return env as {
    BOT_TOKEN: string;
    CATEGORY_ID: bigint;
    DB_PATH: string;
    GUILD_ID: bigint;
  };
};

const { BOT_TOKEN, CATEGORY_ID, DB_PATH, GUILD_ID } = loadEnvs();

type Data = {
  [userId: string]: { subscribed: string[] };
};

const db = {
  path: DB_PATH,
  mutex: new mutex.Mutex(),

  save: async function (o: Data) {
    const data = JSON.stringify(o);
    await Deno.writeTextFile(this.path, data, { create: true });
  },

  load: async function (): Promise<Data> {
    try {
      const data = await Deno.readTextFile(this.path);
      return JSON.parse(data);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        Deno.writeTextFile(this.path, "{}", { create: true });
        return {};
      }

      throw e;
    }
  },
};

import * as discordeno from "https://deno.land/x/discordeno/mod.ts";

const bot = discordeno.createBot({
  token: BOT_TOKEN,
  intents:
    discordeno.Intents.DirectMessages |
    discordeno.Intents.GuildMessages |
    discordeno.Intents.MessageContent,
});

const channelIds = (await discordeno.getChannels(bot, GUILD_ID))
  .filter((c) => c.parentId === CATEGORY_ID)
  .map((c) => c.id);

type Handler = (
  bot: discordeno.Bot,
  message: discordeno.Message,
  signal: unknown
) => void | Promise<void>;

const ignoreBot: Handler = (_, m, s) => {
  if (m.isFromBot) throw s;
};

const allowCategory: Handler = (_, m, s) => {
  if (!channelIds.includes(m.channelId)) throw s;
};

const handleSubscribeCommand: Handler = async (b, m) => {
  if (!m.content.startsWith("!sub")) return;

  const n = m.content.replace("!sub", "").trim();

  try {
    const id = BigInt(n);
    await discordeno.getChannel(b, id);
  } catch {
    await discordeno.sendMessage(b, m.channelId, {
      content: `\`${n}\` という購読先は正しくないらしい.`,
      messageReference: { failIfNotExists: false, channelId: m.channelId },
    });

    return;
  }

  await db.mutex.runExclusive(async () => {
    const authorId = String(m.authorId);

    const data = await db.load();
    if (!data[authorId]) data[authorId] = { subscribed: [] };

    data[authorId].subscribed.push(n);

    await db.save(data);
  });

  await discordeno.sendMessage(b, m.channelId, {
    content: "多分, 購読してる.",
    messageReference: { failIfNotExists: false, channelId: m.channelId },
  });
};

const handleUnsubscribeCommand: Handler = async (b, m) => {
  if (!m.content.startsWith("!unsub")) return;

  const n = m.content.replace("!unsub", "").trim();

  try {
    const id = BigInt(n);
    await discordeno.getChannel(b, id);
  } catch {
    await discordeno.sendMessage(b, m.channelId, {
      content: `\`${n}\` は \`bigint\` ではないらしい.`,
      messageReference: { failIfNotExists: false, messageId: m.id },
    });

    return;
  }

  await db.mutex.runExclusive(async () => {
    const authorId = String(m.authorId);

    const data = await db.load();
    if (!data[authorId]) data[authorId] = { subscribed: [] };

    data[authorId].subscribed = data[authorId].subscribed.filter(
      (s) => s !== n
    );

    await db.save(data);
  });

  await discordeno.sendMessage(bot, m.channelId, {
    content: "多分, 購読してない.",
    messageReference: { failIfNotExists: false, messageId: m.id },
  });
};

const handleDefault: Handler = async (b, m) => {
  const data = await db.mutex.runExclusive(() => db.load());
  const userIds = [];
  for (const [k, v] of Object.entries(data)) {
    if (v.subscribed.includes(String(m.channelId))) userIds.push(k);
  }

  const author = await discordeno.getUser(b, m.authorId);
  const url = bot.helpers.getAvatarURL(author.id, author.discriminator, {
    avatar: author.avatar,
    format: "webp",
  });

  const embed: discordeno.Embed = {
    author: {
      name: author.username,
      iconUrl: url,
    },
    color: 0x888888,
    description: m.content,
    timestamp: m.timestamp,
    title: `<#${m.channelId}>`,
  };

  await Promise.all(
    userIds.map(async (userId) => {
      const channel = await bot.helpers.getDmChannel(userId);
      await discordeno.sendMessage(b, channel.id, { embeds: [embed] });
    })
  );
};

const handlers: Handler[] = [
  ignoreBot,
  allowCategory,
  handleSubscribeCommand,
  handleUnsubscribeCommand,
  handleDefault,
];

bot.events.messageCreate = async (bot, msg) => {
  const obj = new Object();
  for (const handle of handlers) {
    try {
      await handle(bot, msg, obj);
    } catch (e) {
      if (e === obj) break;
      throw e;
    }
  }
};

await discordeno.startBot(bot);
