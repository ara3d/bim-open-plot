# BIM Open Plot branding

Decided 2026-10-11 by Christopher Diggins. BIM Open Plot is one of seven
products in the BIM Open family; the family guide, with the fonts, the
neutrals, the status colours, and the rules every mark follows, is
`docs/BRANDING.md` in the `bim-open-toolkit` repository, and the round
that chose this mark is `docs/brand/explorations/plot-proposals.html`
there. This file holds only what is the plot's own.

## The mark: Flow to Bars

![Flow to Bars](mark.svg)

The node disc on the left, as in the notebook's Flow to Page and the
viewer's mark; one wire leaves it and becomes the first of three rising
bars. It says that the product is a client of the flow host and that an
answer becomes a picture. The three clients of the host, Notebook, Viewer,
and Plot, all start from the disc and differ in what the wire becomes.

`mark.svg` is a 24 by 24 viewBox, one path, one fill, so the path can be
pasted into code. `lockup.svg` sets the mark beside the wordmark.

Rules:

- One colour: ochre (`#a16207`) on a light surface; white on ochre or on a
  dark surface. No gradients, no outline, no shadow.
- Sizes: 16 px (favicon), 22 px (beside the wordmark), 48 px (a page
  heading), 96 px and up (papers, slides). Below 16 px use the three bars
  without the disc and the wire.
- Clear space of half the mark's width on every side.
- Do not rotate, skew, add bars, or recolour the bars separately. The
  mark is not a chart; a chart on a plot page takes the series colours
  below.

## Wordmark

Three words, **BIM Open Plot**, in Instrument Sans: "BIM Open" in weight
600 in the dim colour (`#5a606c`), then "Plot" in weight 700 in the text
colour (`#171a1f`), with a 4 px gap at 15 px. Where a person reads the
name, write the three words; `bim-open-plot` is a name for machines.

## Colours

| Token | Value | Use |
|---|---|---|
| Accent | `#a16207` | The mark, links and buttons, the series colour of a one-series chart |
| Accent soft | `#f6efdb` | Selected row and hover, the selected bar's halo |
| Text | `#171a1f` | Headings, body, axis titles |
| Dim | `#5a606c` | Secondary text, axis labels, the "BIM Open" half of the wordmark |
| Surface, background, border | `#ffffff`, `#f4f5f7`, `#e3e6ea` | As in the family guide; a chart's gridlines use the border colour |
| Status | green `#16a34a`, amber `#d97706`, red `#dc2626` | A result that matches its snapshot, one that changed, an error |

Ochre is 4.9:1 against white, enough for link text and for a bar's label.
It is the one warm accent in a family that is otherwise cool apart from
rose, and a traditional drawing colour. It is darker and browner than the
amber status colour; keep amber for a changed result and ochre for the
chrome and the single series, so a reader never takes a bar for a warning.

A chart with several series takes the data palette (the `view.colormap`
schemes shared with the 3D view, so a coloured model and its chart show
one legend), which is a vocabulary and not a brand colour, as the node
stripes on the flow canvas are. The accent never appears among the
series of a multi-series chart.

## Type

Instrument Sans for the wordmark, page headings, and chart titles; Public
Sans for body text, axis labels, and legends at 11 to 13 px; Fira Code
for values on bars, row counts, and the graph id a figure names.
