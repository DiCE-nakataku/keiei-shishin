# Third-party notices

- `fast-formula-parser` 1.0.19 — MIT. Used as the formula grammar/evaluation engine; source and license: <https://github.com/LesterLyu/fast-formula-parser>. Its latest release is old (1.0.19, published about six years ago), so monitor for maintenance and security updates.
- SheetJS Community Edition 0.20.3 — Apache-2.0. Obtained from the SheetJS CDN tarball, the source identified by SheetJS as authoritative: <https://docs.sheetjs.com/docs/getting-started/installation/frameworks/>.
- Runtime dependencies of `fast-formula-parser`: `bahttext` 1.1.0 (MIT), `bessel` 1.0.2 (Apache-2.0), `chevrotain` 7.1.2 (Apache-2.0), and `jstat` 1.9.3 (MIT).
- Build dependency `esbuild` 0.25.0 — MIT.

The corresponding license texts are copied into `licenses/`. The npm lockfile fixes the calculation and build dependencies. The original calculation and build package set returned zero known vulnerabilities when checked with `npm audit` on 2026-11-18.

HyperFormula was not included: its published terms offer GPLv3 or a separate proprietary license, and no proprietary license grant was available for this task. See <https://handsontable.com/docs/hyperformula/guide/licensing/>.
