Poster esercizi EMPATHY (export manuale da Spline / Blender / Figma / Photoshop)

DOVE SALVARE I FILE (path sul disco, repo):
  public/assets/empathy/exercises/generated/

REGOLA NOME FILE:
  Deve coincidere ESATTAMENTE con il valore nel manifest TypeScript:
    lib/training/builder/generated-image-manifest.ts
  Esempio esercizio "empathy-b1-legpress" -> file:
    empathy-b1-legpress-v2.png

ELENCO COMPLETO (PowerShell, dalla root del repo):
  npm run exercises:list:poster-names
  npm run exercises:list:poster-names:files
  (secondo comando: solo nomi file, uno per riga, utile per checklist)

FORMATO:
  PNG consigliato. Aspect ~16:9 va bene; il Builder mostra thumb e pannello con contain/cover.

NUOVO ESERCIZIO:
  Aggiungi una riga al manifest (id catalogo -> nomefile-v2.png), poi salva il PNG qui.

URL in app:
  /assets/empathy/exercises/generated/<nomefile>
