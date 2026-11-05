# Character sheet generator

The pages at /gwen, /brixa, /finnick, /caelan, /emery and /ajth are generated from these files.

- `chars.js`: the six characters (scores, features, spells, gear).
- `spells.js`: plain-language spell text (2024 rules).
- `build.js`: writes the pages.

Rebuild from the repo root:

```bash
node sheets-src/build.js .
```
