# Dove salvare i testi di riallineamento in Cursor

Due file di supporto (stesso schema in **V1** e **Pro 2**):

| File | Contenuto |
|------|-----------|
| `CURSOR_REALIGN_DAILY.md` | Blocco **breve** per uso quotidiano |
| `CURSOR_REALIGN_DEEP.md` | Blocco **lungo** quando la sessione ha perso la bussola |

## Cursor Settings (consigliato)

1. **Cursor → Settings → Rules → User rules**  
   - Incolla il blocco dentro i triple-backtick da **`CURSOR_REALIGN_DAILY.md`** così resta **sempre** attivo su tutti i progetti.  
   - Opzionale: aggiungi in coda anche il blocco da **`CURSOR_REALIGN_DEEP.md`** se vuoi una sola rule “max”; altrimenti tieni il DEEP solo per incollarlo in chat quando serve (evita contesto enorme fisso).

2. **Progetto multi-root**  
   Se usi `EMPATHY.code-workspace`, le User rules valgono comunque per entrambe le git root.

## In chat (senza toccare Settings)

- **Ogni mattina / task piccolo:** copia solo il blocco da `CURSOR_REALIGN_DAILY.md`.  
- **Sessione fuori rotta:** copia il blocco da `CURSOR_REALIGN_DEEP.md` e chiedi esplicitamente di rileggere i file elencati.

## Mirror in V1

Copie allineate in **`nextjs-empathy-pro/docs/`** (`CURSOR_REALIGN_*.md`, `CURSOR_REALIGN_HOWTO.md`).
