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
5. `KinshipComposer` composes already-resolved semantic classes across
   internal marriage boundaries. A connected path without a narrower verified
   title returns broad `Hama`; `Mutorwa` is reserved for disconnected people.

The application-facing `resolveKinship` function is a compatibility adapter
for the React records. Repeated queries over one immutable family snapshot
should use `createKinshipSession`; it constructs and validates one graph and
reuses one memoizing resolver. Lower-level integrations can instantiate
`FamilyTreeGraph`, `PathReducer`, and `KinshipResolver` directly.

## Primary classification hierarchy

The primary cultural taxonomy contains five ranks on each lineage axis. They
are exposed on every applicable result as `coreClassifications`:

| Rank | Patrilineal | Matrilineal |
| --- | --- | --- |
| Grandparent | `PATRILINEAL_GRANDPARENT` | `MATRILINEAL_GRANDPARENT` |
| Parent | `PATRILINEAL_FATHER` | `MATRILINEAL_MOTHER` |
| Sibling | `PATRILINEAL_SIBLING` | `MATRILINEAL_SIBLING` |
| Child | `PATRILINEAL_CHILD` | `MATRILINEAL_CHILD` |
| Grandchild | `PATRILINEAL_GRANDCHILD` | `MATRILINEAL_GRANDCHILD` |

The ordinary reciprocal algebra is `Grandparent ↔ Grandchild`,
`Father/Mother ↔ Child`, and `Sibling ↔ Sibling`. Spoken-role `KinClass`
values remain a separate layer because promotions override the ordinary
matrix: `Tete` occupies the Father class but reciprocates as
`Muzukuru`; maternal `Sekuru` and his continuing male line occupy the
Matrilineal Grandparent class; and `M.B.D` is promoted to the Matrilineal
Mother class as `Mainini`. Affinal roles remain an overlay and are not counted
among these ten primary classifications.

## Important algebra

- Parallel parents: `F.B -> F`, `M.Z -> M` when the path continues.
- Parallel cousins consequently reduce to sibling-equivalents.
- `M.B.S* -> Sekuru` implements **Sekuru haaperi** recursively.
- `M.B.D -> Mainini` remains a structural exception.
- Consanguineal relatives in ego's grandparent generation (generation
  distance `+2`) generally resolve by target sex: male relatives are `Sekuru`
  and female relatives are `Mbuya`. A grandfather's sister is the specific
  exception and remains `Tete`, whether reached through the paternal or
  maternal grandfather. Other grandparent siblings and cousins continue
  through the general generational rule.
- `F.Z.(S|D)` enters the `Muzukuru`/Patrilineal Grandchild class for both sons
  and daughters of `Tete`, regardless of Ego's sex.
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
- `Mwana.(S|D) -> Muzukuru` enters the reciprocal grandchild class without
  depending on the raw path which originally produced `Mwana`. Later
  descendants then continue through the recursive `Muzukuru` rule above.
- A leading child-to-parent edge composes with the parent's already-resolved
  classificatory-parent term. Thus, if a parent calls someone `Mainini`, the
  child calls that woman `Mbuya`; a male target in the same
  structural position is `Sekuru`. This handles Omaha-skewed paths without a
  lookup entry for the complete path.
- Reciprocally, `(Sekuru|Mbuya).(F|M)*` remains in the grandparent
  class at every higher ancestral generation. The final ancestor's sex selects
  `Sekuru` for a man and `Mbuya` for a woman. This is resolved
  recursively from the immediately lower relative rather than from enumerated
  ancestor paths.

Seniority for `F.B`, `M.Z`, their spouses, and `H.B` is calculated between the
two siblings represented by the selected traversal. Every sibling boundary is
stored as a separate path segment. A terminal ranking rule reads the boundary
nearest its target instead of reusing the first sibling comparison in a long
path. The engine uses explicit sibling seniority first, ordinal `birthOrder`
second, and `birthTimestamp` third; ordinal and date data are never stored in
the same field.

Explicit sibling links form equivalence groups. Every known classificatory
parent of one member—including a parent's spouse—is projected across the full
sibling group. The resulting inferred graph edges make parenthood reciprocal:
each sibling resolves the adult as `Mai`/`Baba`, while the adult resolves every
sibling as `Mwana`. Only the source relationships remain visible in the UI.

Rules are finite algebraic patterns. Recursive lineage behavior is expressed
with structural predicates, not a list of every possible path length.

## Total semantic composition

Path matching remains the fast path for established cultural rules. If that
pipeline does not classify a graph-reachable path, `KinshipComposer` examines
only its internal marriage boundaries and composes the already-resolved prefix
and suffix classes. Recursive subqueries are memoized by Ego, target, sex, and
relative-age context, so repeated subpaths are evaluated once per resolver.

The current semantic composition laws include:

- a same-sex sibling-equivalent inherits the established affinal class beyond
  that sibling's spouse, so `Z.H.M` and longer paths which first reduce to the
  same sibling class resolve to `Vamwene`;
- any prefix already calculated as `Mwana` is compacted to its fundamental
  `S` or `D` class before the remaining child-alliance suffix is evaluated.
  This lets the existing co-parent, in-law sibling, descendant, and lineage
  rules work without knowing how the `Mwana` class was originally reached.

Composition is total with respect to graph reachability at the result level: a
precise established class wins first, an unresolved but connected relationship
becomes `Hama`, and only the absence of a BFS path produces `Mutorwa`. The
engine does not pretend that every semantic class/edge combination has a
verified cultural title. Unsupported combinations remain broad until a
culturally supported law is added.

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

Reference variants remain aliases rather than competing principal titles when
the relationship permits them. A wife's mother is the strict `Ambuya` title
and has no grandmother-name alias. A husband's older brother resolves
principally to `Bamkuru`, and his younger brother to `Bamnini`; `Muramu`
remains an alias for their joking relationship while the social protocol is
`Vasekedzani`.
A wife's older and younger sisters resolve reciprocally to `Maiguru` and
`Mainini`, with `Muramu` retained as an alias; their husbands inherit the
corresponding `Bamkuru` and `Bamnini` titles. A husband's sister is `Tete`.
On the wife-giving descendant branch, a wife's brother's son resolves to
`Sekuru`, while his daughter resolves to `Mainini` with `Muramu` retained as
an alias.

A terminal marriage edge is also projected from the source relative's
already-resolved fundamental kin class. This keeps the algebra compositional:

- `Mwana` rank is retained across marriage: a female spouse resolves as
  `Mwana / Muroora`, while a male spouse resolves as `Mwana / Mukwasha`;
- `Mukoma` and `Munin'ina` project to `Maiguru`/`Bamkuru` and
  `Mainini`/`Bamnini`, preserving the source relative's seniority;
- `Muzukuru` remains `Muzukuru` across the marriage;
- `Sekuru` and `Mbuya` project reciprocally to `Mbuya` and `Sekuru`;
- `Tete` projects to a male spouse as `Bamkuru`;
- A male spouse of `Hanzvadzi` projects to `Tsano`, with `Mukwasha` as the
  alliance title. For a female Ego, her
  brother's wife is principally `Muroora`, because the wife marries into Ego's
  family, with `Maiguru` retained as a valid alternative title; reciprocally,
  the wife calls her husband's sister `Tete`.

The source is resolved recursively through the ordinary BFS and reduction
pipeline before the marriage projection is applied. The recursion always uses
a shorter path and therefore terminates; no complete genealogical path is
registered as a lookup key. Explicit sibling seniority belongs to the source
relative, not their spouse, and is preserved at this boundary.

The reciprocal direction uses the same composition principle. When a path
begins at Ego's spouse, the engine first resolves the spouse-to-target
relationship. Fundamental semantic classes are compacted to `F`, `M`, `S`,
`D`, `B`, or `Z` and passed through the existing short affinal rules. Thus, if
an arbitrarily deep spouse-side path resolves to the husband's `Hanzvadzi`,
the leading `H + Z` projection produces the wife's `Tete`. Stable generational
classes (`Mwana`, `Muzukuru`, `Sekuru`, and `Mbuya`) continue to be inherited
directly. Generic alliance-side labels are returned only after these precise
compositions have been attempted.

The same projection covers a child's spouse and that in-law's family:

- parents and parallel parent-equivalents resolve to `Mukurungai`;
- a son-in-law's male sibling and parallel-cousin line remains `Mukuwasha`;
- a daughter-in-law's female sibling and parallel-cousin line remains
  `Muroora`, while males of that wife-giving line resolve to `Tezvara`;
- children resolve through classificatory co-parenthood as `Muzukuru`;
- piblings and cross-cousins without a narrower verified title retain the
  explicit `Hama yeVakuwasha` or `Hama dzeMuroora` side classification.

## Validation, specificity, and provenance

`FamilyTreeGraph` validates its source snapshot before resolution. Duplicate
IDs, dangling parent/spouse/sibling references, self links, parent cycles,
father/mother sex mismatches, and contradictory seniority cycles produce
structured issues. A resolver backed by an invalid graph returns `invalid`
with those issues instead of silently dropping records or calculating from a
corrupt graph.

Certainty and cultural specificity are separate. A result can be `known` but
only `alliance-side`, such as `Hama yaTezvara`. Specificity ranks as
`exact > classificatory > alliance-side > broad`; this lets a declared,
precise reciprocal class replace a generic forward alliance label.

Rules can expose source, confidence, sex-condition, and scope metadata. The
sex-invariant `M.B.D -> Mainini` rule is marked `attested` from Rose Jaji's
[2025 study](https://doi.org/10.1080/23323256.2025.2468523) and
[2026 study](https://doi.org/10.1080/09589236.2026.2637530). Rules without a
verified source are not assigned invented citations; completing a fully
audited declarative rule registry remains separate cultural-governance work.

All rewrites must replace a match with a strictly shorter path. The reducer
enforces this invariant at runtime, while a defensive pass limit remains in
place. BFS adjacency is sorted so resolution is independent of input record
order.

### Homonymous kin classes

The engine uses both distinct principal spellings and an explicit semantic
class:

- `Mbuya` with `GRANDMOTHER` for a grandmother or recursive
  grandmother-equivalent;
- strict `Ambuya` with `MOTHER_IN_LAW` for a wife's mother-in-law form;
- strict `Ambuya` with `WIFES_BROTHERS_WIFE` for a wife's brother's wife;
- `Vamwene` also carries `MOTHER_IN_LAW` for a husband's mother.

Grandparent recursion, terminal spouse projection, and leading-spouse
inheritance require `GRANDMOTHER`, so `Ambuya` cannot accidentally behave as
`Mbuya` in the algebra even if pronunciation or usage makes the terms closely
related.

The `W.B.W` result is produced compositionally rather than stored as a full
path. A same-generation man on the wife-giving side is classified internally
as `WIFE_GIVING_MALE_PEER`; traversing to his wife projects the distinct
`WIFES_BROTHERS_WIFE` class and its `Ambuya` title. The currently accepted
reciprocal `H.Z.H` direction is the `WIFE_RECEIVER_MALE_PEER` class and is
spoken as `Mukuwasha`.

### Semantic continuation and reciprocity

Every fundamental result carries a semantic `KinClass` independently of its
spoken title. When a resolved prefix has more path remaining, the composer can
replace that prefix with its fundamental `F`, `M`, `S`, `D`, `B`, or `Z` class
and pass the suffix back through the ordinary reducer. For example,
`M.Z.H` resolves to the classificatory-father class; continuing through `.M`
therefore evaluates as `F.M` and produces `Mbuya`. The complete `M.Z.H.M`
path is never stored as a lookup key.

Resolution is also reciprocal at the class level. If a connected forward path
has no precise result, the engine evaluates the reverse traversal once and may
invert it only through a declared cultural class pair, such as
`GRANDMOTHER ↔ MUZUKURU` or
`WIFES_BROTHERS_WIFE ↔ WIFE_RECEIVER_MALE_PEER`. An unordered-pair guard
prevents two unresolved directions from recursively asking each other for an
answer. This preserves `Hama` for genuinely underdetermined relations instead
of guessing from a homonymous title.

The UI-compatible resolver keeps those principal and alternative terms
structured separately, but concatenates them for display with ` / `. Thus a
female Ego's younger brother's wife is displayed as `Muroora / Maiguru`, while
algebraic matching continues to use the principal `Muroora` class.

The projector composes across another marriage boundary only when the prefix
has already resolved to one of the explicit fundamental classes above. The
semantic composer then tries reusable class-level laws; if no narrower law is
established, a multiple-alliance path remains related as broad `Hama` rather
than being incorrectly classified as `Mutorwa`.

## Classificatory parents

Every direct parent or child connection can be marked `biological: true`; an
unchecked connection remains an ordinary functional parent record. A shared
`biologicalUnionId` is assigned whenever two biological parents share a child.
The resolver deliberately ignores both rendering fields. Every person
fulfilling a parent role is represented by the same `F` or `M` edge, and every
child by the reciprocal `S` or `D` edge. Each parent therefore contributes
their complete ancestry, piblings, cousins, descendants, and affinal
relationships.

The UI draws a solid parent-child line for records marked `biological: true`
and a dotted line for functional parenthood.
Two biological parents' lines consolidate at one junction and branch to every
shared biological child, regardless of whether the parents are spouses or
married. A spouse record has an independent symmetric `married` flag; only
married spouses receive the pink connection. Neither marriage nor spousehood
implies biological parenthood.

Every `SPOUSE_OF` record is a culturally recognized union for kinship
calculation. Its symmetric `married` flag controls whether the UI draws the
pink marriage line; it does not disable the affinal edge or its reciprocal.

A recorded parent's spouse is materialized as another classificatory parent of
each child. For example, a mother's husband is reached directly as `F` and is
`Baba`; from him the child can continue to `F.B` (a paternal uncle) or `F.F`
(a grandfather). In the reciprocal direction, he reaches that child directly
as `S` or `D`, which resolves as `Mwana`.

This graph normalization deliberately avoids separate biological, adoptive,
step, and social kinship branches. The algebraic reducer receives one uniform
parent/child vocabulary and applies the ordinary Shona rules to all of them.
