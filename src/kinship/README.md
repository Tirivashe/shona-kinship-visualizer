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
- `F.Z.(S|D)` is `Mwana` for a female ego and `Muzukuru` for a male ego,
  preserving the sex-dependent paternal-aunt cross-cousin distinction.
- `(S|B|F.B.S).W -> Muroora` and `(D|Z|F.Z).H -> Mukuwasha` express
  inward and outward clan alignment.
- `(B|Z).M -> M` promotes a traversed mother's branch to the matrilateral axis,
  allowing later `M.B.S*` rules to apply without enumerating full paths.
- For a same-sex sibling, `(male ego: B | female ego: Z).(S|D)` reduces to
  ego's classificatory-child category (`Mwana`). An opposite-sex sibling's child stays
  in the `Muzukuru` category.

Seniority for `F.B`, `M.Z`, their spouses, and `H.B` is calculated between the
two siblings represented by the selected traversal. The engine uses explicit
sibling seniority first and birth order second; it does not compare those
relatives to ego.

Rules are finite algebraic patterns. Recursive lineage behavior is expressed
with structural predicates, not a list of every possible path length.

## Classificatory parents

`PARENT_OF` deliberately has no biological, adoptive, step, or social
qualifier. Every person fulfilling a parent role is represented by the same `F`
or `M` edge, and every child by the reciprocal `S` or `D` edge. Each parent
therefore contributes their complete ancestry, piblings, cousins, descendants,
and affinal relationships. Extra role labels in older persisted records are
ignored when records are adapted into the engine.

A recorded parent's spouse is materialized as another classificatory parent of
each child. For example, a mother's husband is reached directly as `F` and is
`Baba`; from him the child can continue to `F.B` (a paternal uncle) or `F.F`
(a grandfather). In the reciprocal direction, he reaches that child directly
as `S` or `D`, which resolves as `Mwana`.

This graph normalization deliberately avoids separate biological, adoptive,
step, and social kinship branches. The algebraic reducer receives one uniform
parent/child vocabulary and applies the ordinary Shona rules to all of them.
