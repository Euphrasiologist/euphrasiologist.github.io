---
title: "poa: annotating plant organelle genomes, splicing and editing included"
summary: A new command-line annotator for plant mitochondrial and plastid genomes that rebuilds spliced genes, corrects for RNA editing and annotates the assembly graph itself.
---

Annotating a plant organelle genome sounds like it should be a solved problem. Plastomes are small and well behaved, and there are good tools for them. Plant mitogenomes are different. Several of their genes are trans-spliced, with exons scattered hundreds of kilobases apart, sometimes on opposite strands, and only joined up at the RNA level. C-to-U RNA editing creates start and stop codons that are not in the DNA. And the genomes themselves are often not a single circle but a graph of alternative structures (as has been shown quite a few times now).

[**poa**](https://github.com/Euphrasiologist/poa), the plant organelle annotator, is my attempt to deal with all of that in one pipeline. It grew out of annotating over 1000 species for the database behind our [organelle atlas](/organelles.html), and that database now uses it. This database sort of mirrors the typical DToL pipelines, but is only for plant organellar DNA - currently there are no ways to store GFA's on NCBI etc.

## What it does

- **Core genes, tRNAs and rRNAs**: protein-coding genes are called with `nhmmscan` against [OatkDB](https://github.com/c-zhou/OatkDB)'s land plant gene-family models, tRNAs with tRNAscan-SE and rRNAs with plant rRNA models.
- **RNA editing**: [orfedit](https://github.com/tolkit/orfedit) aligns each gene's protein profile to the genome, allowing for C-to-U edits. It finds the true start and stop codons, including ones that only exist after editing.
- **Spliced genes**: [transsplice](https://github.com/tolkit/transsplice) joins the exons of the trans-spliced _nad1_, _nad2_, _nad5_ and _rps3_, and the cis-spliced _nad4_, _nad7_, _ccmFc_, _cox2_, _rpl2_ and _rps10_. It decides for each species and each intron whether that junction is cis or trans.
- **The assembly graph**: given the GFA, poa maps every gene onto the graph's unitigs as well as the linear contigs, and writes a GFF3 for each.
- **Both organelles**, in one command, from oatk or any other assembler.

## Why it is a step forward

Most organelle annotators cover one organelle. For example GeSeq, CPGAVAS2, PGA and Chloë are built for plastomes.  And PMGA, MITOFY and RhoMitoAnnotator are built for mitogenomes. Many of the best are web servers, which are hard to run on a thousand genomes. `poa` does both organelles, runs from the command line, and bundles all of its reference data, so it is built for whole datasets.

The closest end-to-end tool is probably [oatk](https://github.com/c-zhou/oatk), which we use to assemble our genomes. `oatk`'s gene calls are a by-product of assembly, and running the same gene models directly and then reconstructing the genes makes a real difference:

- **Fragmented genes become whole genes.** `oatk` only ever found one piece of _nad5_. Calling genes directly found all four exon fragments in every species in our test set, and roughly doubled the share of trans-spliced genes we could reconstruct completely.
- **Missing genes come back.** In some species `oatk` called none of _nad1_, _nad2_, _nad5_ or _rps3_, or no genes at all, despite a good assembly. `poa` finds them.
- **Coordinates on the graph.** As far as we know, `poa` is the only annotator that gives gene positions on the assembly graph's unitigs as well as the linear contigs. That matters when the "genome" is a set of alternative structures rather than one sequence.

## `poa` works quite well

We tested `poa` against the curated RefSeq annotation of the _Arabidopsis thaliana_ mitogenome, using an independent PacBio assembly from the Darwin Tree of Life:

- **54 of 55** annotated genes found. The 55th is a naming difference.
- Edit-corrected proteins of single-exon genes match the curated proteins at **99.5 to 100%** identity.
- _nad4_ and _nad7_ are rebuilt with every exon boundary exact to the base, and _nad2_ and _rps3_ with all their exons.

Across the full dataset, `poa` rebuilds complete spliced genes in 55% (_nad5_) to 81% (_rps10_) of the species that have them. Its weakest point is mosses (which I'm working on correcting now). The templates are mostly built from flowering plants, so some moss genes are placed less well. Lineage-specific templates are the next step.

## Please try it!

```bash
mamba env create -f environment.yml
conda activate poa
pip install .
poa run --mito sample.mito.ctg.fasta --mito-gfa sample.mito.gfa \
        --pltd sample.pltd.ctg.fasta --pltd-gfa sample.pltd.gfa \
        -o out/ -t 8
```

An _Arabidopsis_ mitogenome and plastome take about five minutes on four cores. A bioconda package and container images are on the way. `poa` is on [GitHub](https://github.com/Euphrasiologist/poa), and I'd love to hear how it does on your genomes.

As it stands, I'll keep updating [the database](https://github.com/ARU-life-sciences/plant_organelle_database) live [on this site](/organelles.html), and attempt to get the most comprehensive set of assemblies and annotations for plant organellar genomes out there.
