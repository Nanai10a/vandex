# [vandex](https://l.thisworddoesnotexist.com/b53W)

_Approvers' "-times" helper Bot_

---

## roadmap

- [ ] `v0.2` : rewrite all
- [x] `v0.1` : initial implement

## usage

```console
> deno run -A main.ts
```

### environment values

| key           | description          | optional |
| ------------- | -------------------- | -------- |
| `BOT_TOKEN`   | bot's token          | no       |
| `GUILD_ID`    | target guild's id    | no       |
| `CATEGORY_ID` | target category's id | no       |

## features

wrote with ja:

限界開発鯖の "-times" 文化, その支援をする Bot です.

### 購読

"-times" に送信された message を別チャンネルに転送します.\
また, Bot からのメッセージの一切は除外されます.

現状, 転送先は**購読を指定した user の direct message** に限定されます.

以下の command が "-times" channel で使用可能です.

- `!sub <CHANNEL_ID>` : `<CHANNEL_ID>` を購読指定する.
- `!unsub <CHANNEL_ID>` : `CHANNEL_ID>` を購読解除する.
