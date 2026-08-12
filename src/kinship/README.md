# Shona kinship resolver

The resolver treats the family graph as biological/genealogical truth and the
rules in `resolve.ts` as cultural interpretation from a selected ego.

## Resolution order

1. Find every equally short simple path from ego to target.
2. Repeatedly reduce path fragments with reusable cultural equivalences in
   `infer.ts` until a canonical fixed point is reached.
3. Match the reduced path against a small set of canonical Shona categories.
4. Prefer explicit cross-cousin and affinal exceptions where the guide says
   the general equivalences do not apply.
5. Return an explicit `ambiguous`, `contextual`, or `unmapped` result rather
   than inventing a title.

The inference engine composes rules such as "father's brother is a social
father," "a social parent's child is a sibling-equivalent," and "a
sibling-equivalent's mother is a social mother." Consequently, a deep path can
reduce to a familiar canonical category without adding a title entry for that
complete path. Results expose `canonicalSteps` and `derivation` for auditing.

## Deliberate project decisions

- `Mai` is canonical because it is the guide's table entry; `Amai` is retained
  as an alias.
- `Bamkuru` and `Bamnini` are canonical. Longer spellings are aliases.
- The guide gives both `Tsano` and `Tezvara` for a wife's brother, so that case
  is contextual rather than silently choosing one.
- A direct husband is `Murume`; a direct wife is `Mukadzi`.
- Social-parent seniority survives marriage inference: Bamkuru's wife is
  `Maiguru`, Bamnini's wife is `Mainini`, Maiguru's husband is `Bamkuru`, and
  Mainini's husband is `Bamnini`.
- The guide does not define maternal-uncle-child terms for a female ego, so
  those paths remain unmapped.
- `Tateguru` begins at three upward generations. This is an explicit project
  threshold because the guide only says "distant male ancestor."
- A shared parent establishes siblinghood even without a duplicated
  `SIBLING_OF` record. Seniority comes from an explicit sibling edge first and
  birth dates second.
- A same-sex sibling is socially parallel to ego, so that sibling's son or
  daughter is `Mwana` (ego's social child). For example, a male ego's younger
  brother's son resolves from `younger_brother → son` to `Mwana`.

`ruleId`, `aliases`, `possibilities`, and the selected genealogical `path` are
returned so the UI can explain and audit every result.
