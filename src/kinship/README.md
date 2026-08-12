# Shona kinship resolver

The resolver treats the family graph as biological/genealogical truth and the
rules in `resolve.ts` as cultural interpretation from a selected ego.

## Resolution order

1. Find every equally short simple path from ego to target.
2. Apply cross-cousin exceptions from the supplied guide.
3. Apply affinal (marriage) rules.
4. Normalize biological siblings and parallel cousins into the guide's
   sibling-equivalent category.
5. Apply direct parent, parent-sibling, grandparent, descendant, and ancestor
   rules.
6. Return an explicit `ambiguous`, `contextual`, or `unmapped` result rather
   than inventing a title.

## Deliberate project decisions

- `Mai` is canonical because it is the guide's table entry; `Amai` is retained
  as an alias.
- `Bamkuru` and `Bamnini` are canonical. Longer spellings are aliases.
- The guide gives both `Tsano` and `Tezvara` for a wife's brother, so that case
  is contextual rather than silently choosing one.
- The guide does not define maternal-uncle-child terms for a female ego, so
  those paths remain unmapped.
- `Tateguru` begins at three upward generations. This is an explicit project
  threshold because the guide only says "distant male ancestor."
- A shared parent establishes siblinghood even without a duplicated
  `SIBLING_OF` record. Seniority comes from an explicit sibling edge first and
  birth dates second.

`ruleId`, `aliases`, `possibilities`, and the selected genealogical `path` are
returned so the UI can explain and audit every result.
