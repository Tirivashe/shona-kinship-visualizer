# Dynamic Shona kinship engine

The engine is a generative K-Path system. It never maps complete genealogical
paths to a dictionary of titles.

## Pipeline

1. `FamilyTreeGraph` builds parent, child, and spouse edges from graph-native
   `Person` records and finds every equally short path with BFS.
2. Raw steps (`F M S D H W`) are canonicalized to anthropological K-Paths.
   Parent-to-other-child fragments become `B` or `Z`.
3. `PathReducer` applies terminating algebraic rewrites across the patrilineal,
   matrilateral, and affinal axes until it reaches a fixed point.
4. `KinshipResolver` evaluates structural exceptions and reduced fundamental
   categories using ego sex, target sex, relative age, and path generation.
5. An unrecognized relationship returns `Mutorwa / Relationship Unmapped`.

The application-facing `resolveKinship` function is only an adapter for the
older React demo records. New integrations should instantiate
`FamilyTreeGraph`, `PathReducer`, and `KinshipResolver` directly.

## Important algebra

- Parallel parents: `F.B -> F`, `M.Z -> M` when the path continues.
- Parallel cousins consequently reduce to sibling-equivalents.
- `M.B.S* -> Sekuru` implements **Sekuru haaperi** recursively.
- `M.B.D -> Mainini` remains a structural exception.
- Any consanguineal relative in ego's grandparent generation (generation
  distance `+2`) resolves by target sex: male relatives are `Sekuru` and female
  relatives are `Ambuya`. This generatively includes grandparents' siblings
  and cousins, including the relatives who are piblings to ego's parent.
- `F.Z.(S|D)` is `Mwana` for a female ego and `Muzukuru` for a male ego,
  preserving the sex-dependent paternal-aunt cross-cousin distinction.
- Affinal paths are projected over a reduced classificatory lineage rather
  than matched as complete strings. A W edge from a clan-aligned man produces
  `Muroora`; an H edge from a clan-aligned woman produces `Mukuwasha`.
- `(B|Z).M -> M` promotes a traversed mother's branch to the matrilateral axis,
  allowing later `M.B.S*` rules to apply without enumerating full paths.
- For a same-sex sibling, `(male ego: B | female ego: Z).(S|D)` reduces to
  ego's classificatory-child category (`Mwana`). An opposite-sex sibling's child stays
  in the `Muzukuru` category.
- `Muzukuru.(S|D)* -> Muzukuru` is evaluated recursively from the resolved
  parent class. Consequently, children and all later descendants of any
  `Muzukuru` remain `Muzukuru`, whether that starting class came from a
  grandchild, paternal-aunt child, opposite-sex sibling's child, or another
  supported projection.
- Reciprocally, `(Sekuru|Ambuya|Mbuya).(F|M)*` remains in the grandparent
  class at every higher ancestral generation. The final ancestor's sex selects
  `Sekuru` for a man and `Ambuya` (alias `Mbuya`) for a woman. This is resolved
  recursively from the immediately lower relative rather than from enumerated
  ancestor paths.

Seniority for `F.B`, `M.Z`, their spouses, and `H.B` is calculated between the
two siblings represented by the selected traversal. The engine uses explicit
sibling seniority first and birth order second; it does not compare those
relatives to ego.

Explicit sibling links form equivalence groups. Every known classificatory
parent of one member—including a parent's spouse—is projected across the full
sibling group. The resulting inferred graph edges make parenthood reciprocal:
each sibling resolves the adult as `Mai`/`Baba`, while the adult resolves every
sibling as `Mwana`. Only the source relationships remain visible in the UI.

Rules are finite algebraic patterns. Recursive lineage behavior is expressed
with structural predicates, not a list of every possible path length.

## Affinal projection and social protocol

`AffinalProjector` treats a marriage as a directional alliance between a
wife-giving line and a wife-receiving line. It finds the single marriage
boundary, reduces only the consanguine segment on the other side, checks
classificatory patrilineage membership, and projects the result using target
sex and generation. This supports recursive cases such as a wife's paternal
uncle or cousin without registering `W.F.B` or `W.F.B.S` as complete paths.

The principal result is returned in `title`. Affinal results additionally
return `socialTerm` and `socialDescription`:

- `Vanyarikani` marks relationships governed primarily by respect, restraint,
  and honorific address: `Tezvara`, `Vamwene`, `Ambuya`, `Mukuwasha`,
  `Muroora`, and `Mukurungai`.
- `Vasekedzani` marks reciprocal joking relationships, particularly `Muramu`
  and the grandparent categories entered through a spouse.
- `Vakaroorana` marks the reciprocal relationship between spouses.

Reference variants remain aliases rather than competing principal titles. For
example, a wife's mother resolves principally to `Ambuya`, with `Mbuyawasha`
and `Ambuyawasha` as aliases. A husband's older brother resolves principally
to `Bamkuru`, and his younger brother to `Bamnini`; `Muramu` remains an alias
for their joking relationship while the social protocol is `Vasekedzani`.
A wife's older and younger sisters resolve reciprocally to `Maiguru` and
`Mainini`, with `Muramu` retained as an alias; their husbands inherit the
corresponding `Bamkuru` and `Bamnini` titles. A husband's sister is `Tete`.
On the wife-giving descendant branch, a wife's brother's son resolves to
`Sekuru`, while his daughter resolves to `Mainini` with `Muramu` retained as
an alias.

A terminal marriage edge is also projected from the source relative's
already-resolved fundamental kin class. This keeps the algebra compositional:

- `Mwana` projects to `Muroora` for a female spouse and `Mukuwasha` for a male
  spouse;
- `Mukoma` and `Munin'ina` project to `Maiguru`/`Bamkuru` and
  `Mainini`/`Bamnini`, preserving the source relative's seniority;
- `Muzukuru` remains `Muzukuru` across the marriage;
- `Sekuru` and `Mbuya` project reciprocally to `Mbuya` and `Sekuru`;
- `Tete` projects to a male spouse as `Bamkuru`;
- `Hanzvadzi` projects to `Tsano` for a male spouse and `Maiguru` for a female
  spouse.

The source is resolved recursively through the ordinary BFS and reduction
pipeline before the marriage projection is applied. The recursion always uses
a shorter path and therefore terminates; no complete genealogical path is
registered as a lookup key. Explicit sibling seniority belongs to the source
relative, not their spouse, and is preserved at this boundary.

The same projection covers a child's spouse and that in-law's family:

- parents and parallel parent-equivalents resolve to `Mukurungai`;
- a son-in-law's male sibling and parallel-cousin line remains `Mukuwasha`;
- a daughter-in-law's female sibling and parallel-cousin line remains
  `Muroora`, while males of that wife-giving line resolve to `Tezvara`;
- children resolve through classificatory co-parenthood as `Muzukuru`;
- piblings and cross-cousins without a narrower verified title retain the
  explicit `Hama yeVakuwasha` or `Hama dzeMuroora` side classification.

The projector composes across another marriage boundary only when the prefix
has already resolved to one of the explicit fundamental classes above. Other
multiple-alliance paths still remain unmapped rather than implying an
unsupported cultural equivalence.

## Classificatory parents

Every direct parent or child connection can be marked `biological: true`; an
unchecked connection remains an ordinary functional parent record. A shared
`biologicalUnionId` is assigned whenever two biological parents share a child.
The resolver deliberately ignores both rendering fields. Every person
fulfilling a parent role is represented by the same `F` or `M` edge, and every
child by the reciprocal `S` or `D` edge. Each parent therefore contributes
their complete ancestry, piblings, cousins, descendants, and affinal
relationships.

The UI draws a parent-child line only for records marked `biological: true`.
Two biological parents' lines consolidate at one junction and branch to every
shared biological child, regardless of whether the parents are spouses or
married. A spouse record has an independent symmetric `married` flag; only
married spouses receive the pink connection. Neither marriage nor spousehood
implies biological parenthood.

A recorded parent's spouse is materialized as another classificatory parent of
each child. For example, a mother's husband is reached directly as `F` and is
`Baba`; from him the child can continue to `F.B` (a paternal uncle) or `F.F`
(a grandfather). In the reciprocal direction, he reaches that child directly
as `S` or `D`, which resolves as `Mwana`.

This graph normalization deliberately avoids separate biological, adoptive,
step, and social kinship branches. The algebraic reducer receives one uniform
parent/child vocabulary and applies the ordinary Shona rules to all of them.
