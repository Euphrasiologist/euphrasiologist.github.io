#!/usr/bin/env python3
"""Build the ploidyspec panel for ploidy.html from a clone of ARU-life-sciences/ploidyspec.

    python3 scripts/build_ploidy_db.py --src <ploidyspec clone>

writes data/ploidy.json (the panel: one row per species, the four answers, the literature) and
data/ploidy/<species>.json (the whole-chromosome distance matrix, the per-chromosome states,
divergence along every chromosome, the homeology map, homeolog pairs, blocks and fusions).
Distances are stored as integers, distance x 1e5.
"""
import argparse
import csv
import json
import math
import re
import subprocess
from collections import defaultdict
from pathlib import Path

SKIP = {"OncMaso1_wu2026"}  # a re-run of OncMaso1 on another assembly
PARTS = {"lpTriTurg1_A": ("lpTriTurg1", "A subgenome"), "lpTriTurg1_B": ("lpTriTurg1", "B subgenome")}

# names the assembly headers don't give cleanly
NAMES = {
    "daMimPere1": "Mimulus peregrinus", "daPilAura1": "Pilosella aurantiaca", "daSenVulg1": "Senecio vulgaris",
    "daSonOler1": "Sonchus oleraceus", "ddHesMatr1": "Hesperis matronalis", "ddLepDrab1": "Lepidium draba",
    "ddSalTria1": "Salix triandra", "drAriEdul1": "Aria edulis", "drLytSali1": "Lythrum salicaria",
    "drMyrSpic1": "Myriophyllum spicatum", "drMyrVert1": "Myriophyllum verticillatum",
    "llColAutu1": "Colchicum autumnale", "SchYoun1": "Schizothorax younghusbandi",
    "SchCurv1": "Schizothorax curvilabiatus", "OncMaso1": "Oncorhynchus masou", "fAmiCal2": "Amia calva",
    "fLepOcu1": "Lepisosteus oculatus", "fSalAlp3": "Salvelinus alpinus", "daInuConz1": "Inula conyza",
    "drSorDevo1": "Karpatiosorbus devoniensis", "lpTriTurg1": "Triticum turgidum",
}


def group(sp):
    if sp.startswith(("Sch", "Onc", "f")):
        return "Fishes"
    if sp.startswith("x"):
        return "Molluscs"
    if sp.startswith("i"):
        return "Insects"
    if sp.startswith("l"):
        return "Monocots"
    return "Eudicots"


# What the papers in the project's reading list say about particular species. verdict: agrees,
# partly (agrees in part, with calls the paper does not support), or context.
NOTES = {
    "SchYoun1": ("agrees", "Xie et al. (2026) describe an autotetraploid with 4n = 90 rather than 100, after five "
                 "unbalanced fusions (chromosomes 19–22, 4–15, 8–16, 20–23 and 11–14). ploidyspec finds the "
                 "same five. The paper's pericentric inversion on chromosome 17, with a disomic-like short arm, "
                 "matches the one chromosome read here as a regional split.", "Xie et al. 2026, Nature"),
    "SchCurv1": ("partly", "Xie et al. (2026) report 2n = 98 with only the ancestral 19–22 fusion, which ploidyspec "
                 "finds. Their allele ratios show disomy only on chromosomes 19 and 22, so the other "
                 "non-tetrasomic readings here (chromosomes 1, 11, 12, 13, 17 and 21) are unconfirmed.",
                 "Xie et al. 2026, Nature"),
    "OncMaso1": ("agrees", "33 chromosome numbers, as in the published assembly. Salmonids descend from an "
                 "autotetraploidy 80–95 million years ago; in Atlantic salmon about a quarter of the genome, on "
                 "seven pairs of homeologous arms, rediploidized late and separately in each lineage, so a few "
                 "partly resolved chromosomes are expected.",
                 "Wu et al. 2026, Sci. Data; Lien et al. 2016, Nature; Robertson et al. 2017, Genome Biol."),
    "fSalAlp3": ("context", "Salmonids descend from an autotetraploidy 80–95 million years ago. About a quarter "
                 "of the genome rediploidized late and separately in each lineage, so homeolog pairs as close "
                 "as some alleles are expected here.", "Lien et al. 2016, Nature; Robertson et al. 2017, Genome Biol."),
    "fCorLav1": ("context", "Whitefish share the salmonid autotetraploidy (80–95 million years ago), and its "
                 "late, lineage-specific rediploidization.", "Robertson et al. 2017, Genome Biol."),
    "fAmiCal2": ("context", "The bowfin branched off before the teleost genome duplication, so it is a negative "
                 "control: no young homeolog pairs are expected.", "Parey et al. 2022, Genome Res."),
    "fLepOcu1": ("context", "The spotted gar branched off before the teleost genome duplication, so it is a "
                 "negative control: no young homeolog pairs are expected.", "Parey et al. 2022, Genome Res."),
    "lpTriTurg1": ("agrees", "Durum wheat is an allotetraploid (BBAA, 2n = 28) that formed 0.5–0.9 million years "
                   "ago. The Ph1 locus keeps pairing disomic and homeologous exchange is rare, as found here. "
                   "The distance between its subgenomes dates the split of its two parent species, not an old "
                   "duplication.", "Zhang et al. 2020, PNAS; Wang et al. 2019, Front. Genet."),
    "ddAraThal4": ("agrees", "A diploid (2n = 10). Only about a fifth of the duplicates from its genome "
                   "duplication about 50 million years ago survive, so no homeolog pairs are expected.",
                   "Crombez et al. 2025, Nat. Commun."),
    "dcCerAlpi1": ("agrees", "2n = 72 from three accessions, which matches 36 chromosome numbers in two copies. "
                   "Boşcaiu et al. count it as tetraploid on x = 18 (octoploid only on x = 9). The C. alpinum "
                   "complex is widely introgressed, which fits a hybrid origin but does not settle it.",
                   "Boşcaiu et al. 1999, Plant Syst. Evol."),
    "drRosSpin1": ("context", "In tetraploid rose, preferential pairing differs between chromosomes and even "
                   "between the arms of one chromosome, so a segmental reading fits better than a strict auto "
                   "or allo call.", "Bourke et al. 2017, Plant J."),
    "dmRanRepe1": ("context", "The genus has a base number of x = 8, and Ranunculaceae share a genome "
                   "duplication about 53 million years ago, which can add old homeolog pairs beside a younger "
                   "split.", "Karbstein et al. 2025, Plant J."),
    "drRosCani1": ("agrees", "Dog roses (section Caninae) have Canina meiosis: in a pentaploid, one subgenome pairs "
                   "as bivalents from two near-identical copies, while the other three stay unpaired (univalent) "
                   "and pass only through the egg. Herklotz et al. (2025) found this in a phased R. canina genome: "
                   "two homozygous copies of the pairing subgenome, and more divergent univalent ones. It shows "
                   "here too: HAP1 and HAP2 are almost identical on every chromosome (median distance 0.0004), the "
                   "pairing subgenome, while HAP1B, HAP1C and HAP1D are three distinct unpaired sets (0.025 to "
                   "0.05 from the rest). ploidyspec's two-way split puts HAP1B with the pairing pair, so read it "
                   "as one pairing set plus three non-recombining ones rather than two lineages.",
                   "Herklotz et al. 2025, Nature"),
    "ddHypPerf1": ("context", "A duplication specific to this lineage shows in its gene ages (Ks ≈ 0.13), "
                   "consistent with tetraploidy but silent on its origin.", "Ren et al. 2018, Mol. Plant"),
}
for sp in ("xgCepNemo3", "xgMonCant1"):
    NOTES[sp] = ("context", "Land snails and slugs (Stylommatophora) share an old genome duplication, seen in "
                 "this species' duplicated Hox clusters.", "McHale et al. 2025, J. Exp. Zool. B")
for sp in ("xgHygCinc1", "xgDauRufa1"):
    NOTES[sp] = ("context", "Land snails and slugs (Stylommatophora) share an old genome duplication, seen in "
                 "their duplicated Hox clusters.", "McHale et al. 2025, J. Exp. Zool. B")
for sp in ("xgLitLitt3", "xgPomEleg1", "xgStaPalu1"):
    NOTES[sp] = ("context", "Outside the land snails and slugs, so without their shared genome duplication.",
                 "McHale et al. 2025, J. Exp. Zool. B")


def rows(path):
    if not Path(path).is_file():
        return []
    return list(csv.DictReader((l for l in open(path) if not l.startswith("#")), delimiter="\t"))


def num(v, f=float):
    try:
        x = f(v)
        return None if isinstance(x, float) and math.isnan(x) else x
    except (TypeError, ValueError):
        return None


def q(v):
    """distance x 1e5 as an int, -1 for missing"""
    v = num(v)
    return -1 if v is None else round(v * 1e5)


def clean_lit(r):
    """The public parts of a literature_ploidy.tsv row: no notes about how it was compiled."""
    if not r:
        return None
    bad = re.compile(r"session|user|recollection|not (externally|formally)|to verify|resolved 20", re.I)

    def part(v, n=200):
        v = (v or "").split(" -- ")[0].strip().strip('"')
        if not v or bad.search(v) or v.lower() in ("none", "n/a", "unspecified"):
            return ""
        return v if len(v) <= n else v[: v.rfind(" ", 0, n)] + "…"

    out = {"ploidy": part(r["literature_ploidy_level"]), "count": part(r["literature_chrom_number"], 60),
           "origin": part(r["literature_origin"]), "cites": part(r["key_citations"], 260)}
    return out if any(out.values()) else None


def species_name(sp, d):
    base = sp.split("_")[0]
    if base in NAMES:
        return NAMES[base]
    seq = rows(d / "sequences.tsv")
    m = re.match(r"([A-Z][a-z]+ [a-z-]+)", seq[0]["desc"]) if seq else None
    return m.group(1) if m else base


def answers(d):
    return {r["question"]: [r["answer"], r["confidence"], r["evidence"]] for r in rows(d / "summary.tsv")}


def matrix(d, units):
    with open(d / "matrix/whole_chrom_distance_matrix.csv") as fh:
        r = list(csv.reader(fh))
    head = r[0][1:]
    at = {u: i for i, u in enumerate(head)}
    vals = {row[0]: row[1:] for row in r[1:]}
    out = []
    for i, a in enumerate(units):
        for b in units[i + 1:]:
            out.append(q(vals[a][at[b]]) if a in vals and b in at else -1)
    return out  # upper triangle, row-major


def windowed(d):
    """per chromosome: window size and one track per directional copy pair"""
    out = defaultdict(lambda: {"tracks": defaultdict(dict)})
    step = None
    for r in rows(d / "windowed/windowed_all.tsv"):
        if "distance" not in r:
            return {}, None
        s, e = int(r["win_start"]), int(r["win_end"])
        step = step or e - s + 1
        out[r["group"]]["tracks"][r["unit_a"], r["unit_b"]][(s - 1) // step] = q(r["distance"])
    res = {}
    for g, v in out.items():
        tracks = []
        for (a, b), w in sorted(v["tracks"].items()):
            n = max(w) + 1
            tracks.append([a, b, [w.get(i, -1) for i in range(n)]])
        res[g] = tracks
    return res, step


def homeology(d):
    out = {}
    for r in rows(d / "homeologs/homeology_map.tsv"):
        a = r["anchor"]
        o = out.setdefault(a, {"chrom": r["chrom"], "w": []})
        i = (int(r["win_start"]) - 1) // 250000
        while len(o["w"]) < i:
            o["w"].append(None)
        z = num(r["z"])
        o["w"].append([r["best"], q(r["best_dist"]), None if z is None else round(z, 1),
                       1 if r["homeolog_like"] == "yes" else 0])
    return out


def te_subgenomes(d):
    """scripts/te_subgenomes.py: do the copies fall into subgenomes by repeats only they carry?
    Returns the panel-level call (chosen k, whole genome and homeolog blocks only), the per-unit
    cluster, a painting of every copy in 500 kb windows, marker densities and, per set of
    homeologous chromosomes, whether the repeat split matches the distance split."""
    summ = [r for r in rows(d / "te_subgenomes/summary.tsv") if r.get("chosen") == "yes"]
    if not summ:
        return None, None
    r = summ[0]
    blk = [x for x in rows(d / "te_subgenomes_blocks/summary.tsv") if x.get("chosen") == "yes"]
    call = {"call": r["call"], "k": num(r["k"], int), "frac": num(r["consistent_frac"]),
            "nullMean": num(r["null_mean"]), "nullMax": num(r["null_max"]), "p": num(r["p"]),
            "sizes": r["cluster_sizes"], "agree": r["chroms_agreeing_with_distance"],
            "hapFiles": r.get("clusters_follow_hap_files") == "True"}
    if blk and blk[0]["cluster_sizes"] != r["cluster_sizes"] or blk and blk[0]["consistent_frac"] != r["consistent_frac"]:
        b = blk[0]
        call["blocks"] = {"call": b["call"], "frac": num(b["consistent_frac"]), "nullMax": num(b["null_max"]),
                          "agree": b["chroms_agreeing_with_distance"]}
    clusters = {x["unit"]: x["cluster"] for x in rows(d / "te_subgenomes/clusters.tsv")}
    code = {"S1": "1", "S2": "2", "S3": "3", "S4": "4", "ambiguous": "?"}
    step = 500000
    paint = defaultdict(dict)
    for w in rows(d / "te_subgenomes/windows.tsv"):
        paint[w["unit"]][(int(w["start"]) - 1) // step] = code.get(w["assigned"], ".")
    paint = {u: "".join(v.get(i, ".") for i in range(max(v) + 1)) for u, v in paint.items()}
    cps = rows(d / "te_subgenomes/copies.tsv")
    copies = {x["unit"]: [num(x["home_frac"]), num(x["n_foreign_runs"], int)] for x in cps}
    # how often a window is painted with its own chromosome's group: where this is low, the
    # window painting says less than the whole-chromosome clusters and the page shows those
    nw = sum(num(x["n_windows"], int) or 0 for x in cps)
    home = sum((num(x["n_windows"], int) or 0) * (num(x["home_frac"]) or 0) for x in cps)
    win_agree = round(home / nw, 3) if nw else None
    rates = [[x["marker_set"]] + [num(v) for k, v in x.items() if k.startswith("in_")]
             for x in rows(d / "te_subgenomes/rates.tsv")]
    agree = [[x["chrom"], x["agrees"] == "True", x["te_partition"], x["distance_partition"]]
             for x in rows(d / "te_subgenomes/distance_agreement.tsv")]
    data = {"step": step, "clusters": clusters, "paint": paint, "copies": copies, "rates": rates, "agree": agree,
            "winAgree": win_agree}
    return call, data


def pick(r, keys, conv=None):
    out = {}
    for k in keys:
        v = r.get(k, "")
        if v not in ("", None):
            out[k] = conv(v) if conv and num(v) is not None else v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="clone of ploidyspec")
    ap.add_argument("--out", default="data")
    args = ap.parse_args()
    src = Path(args.src)
    git = lambda *a: subprocess.run(["git", "-C", src, *a], capture_output=True, text=True).stdout.strip()
    lit = {r["species"]: r for r in rows(src / "meta/literature_ploidy.tsv")}
    cat = {r["species"]: r["category"] for r in rows(src / "meta/species_categories.tsv")}
    cat["lpTriTurg1"] = cat.get("lpTriTurg1_AB", cat.get("lpTriTurg1"))
    outdir = Path(args.out) / "ploidy"
    outdir.mkdir(parents=True, exist_ok=True)
    panel = []
    for d in sorted((src / "results").iterdir(), key=lambda p: p.name.lower()):
        sp = d.name
        if sp in SKIP or not (d / "summary.tsv").is_file():
            continue
        seq = rows(d / "sequences.tsv")
        units = sorted((r["unit_id"] for r in seq), key=lambda u: (int(re.sub(r"\D", "", u.split("_chr")[1]) or 0), u))
        unit_rows = {r["unit_id"]: r for r in seq}
        chroms = []
        for r in rows(d / "rediploidization/rediploidization_by_chrom.tsv"):
            c = pick(r, ["chrom", "n_copies", "haps_missing", "fusion", "group_a", "group_b", "split_extent",
                         "split_segments", "copy_state", "state_basis", "pooled_with", "outlier_hap",
                         "ancient_partner", "ancient_state", "residual_terminal", "residual_segments",
                         "residual_support", "exchange_support", "exchange_segments", "lineage_switches",
                         "block_partners"])
            c.update(pick(r, ["dist_split", "te_split", "window_split_frac", "window_covered", "window_null_q95",
                              "distance_ratio", "residual_frac"], float))
            c.update(pick(r, ["residual_bp", "residual_terminal_bp", "exchange_bp"], int))
            chroms.append(c)
        win, step = windowed(d)
        hm = homeology(d)
        blocks = [pick(r, ["anchor", "chrom", "partner", "position", "reciprocal", "low_divergence"]) |
                  pick(r, ["start", "end", "n_windows"], int) | pick(r, ["median_dist", "median_z"], float)
                  for r in rows(d / "homeologs/homeolog_blocks.tsv")]
        pairs = [pick(r, ["chrom_a", "chrom_b", "n_haplotype_copy_pairs"]) |
                 pick(r, ["mean_distance", "z_score", "q_value"], float)
                 for r in rows(d / "homeologs/homeolog_pairs.tsv")]
        # fusions, with the divergence profile along each fused scaffold: per 250 kb window, which
        # component it matches, its distance to the closest unfused copy, and to the other fused copy
        prof = defaultdict(list)
        for r in rows(d / "rediploidization/fusion_profile.tsv"):
            prof[r["scaffold"]].append([(int(r["win_start"]) - 1) // 250000, r["component"],
                                        q(r["d_unfused"]), q(r["d_fused"])])
        fusions = []
        for r in rows(d / "rediploidization/fusions.tsv"):
            f = pick(r, ["scaffold", "hap", "origin", "components", "status", "lineage_divergence"]) | \
                pick(r, ["length"], int) | \
                pick(r, ["junction_mb", "junction_agreement", "near_junction_div", "arm_end_div",
                         "junction_gradient", "fused_within_div", "max_z"], float)
            if prof.get(r["scaffold"]):
                f["profile"] = prof[r["scaffold"]]
            fusions.append(f)
        tei = rows(d / "subgenomes/auto_allo_index.tsv")
        tes, tesub = te_subgenomes(d)
        hms = {r["metric"]: r["value"] for r in rows(d / "homeologs/homeology_map_summary.tsv")}
        ps = {r["species"]: r for r in rows(src / "meta/panel_summary.tsv")}.get(sp, {})
        data = {
            "units": [[u, unit_rows[u]["hap"], int(unit_rows[u]["chrom"]), int(unit_rows[u]["length"])] for u in units],
            "matrix": matrix(d, units), "chroms": chroms, "step": step, "windows": win, "homeology": hm,
            "blocks": blocks, "pairs": pairs, "fusions": fusions,
            "te": [[r["unit_a"], r["unit_b"], num(r["te_marker_fraction"])] for r in tei],
            "tesub": tesub,
        }
        (outdir / f"{sp}.json").write_text(json.dumps(data, separators=(",", ":")))
        states = defaultdict(int)
        for c in chroms:
            states[c.get("copy_state", "not_assessable")] += 1
        haps = sorted({unit_rows[u]["hap"] for u in units})
        nums = sorted({unit_rows[u]["chrom"] for u in units}, key=int)
        per = defaultdict(set)
        for u in units:
            per[unit_rows[u]["chrom"]].add(unit_rows[u]["hap"])
        copies = num(ps.get("copies_per_chromosome"), int) or max(len(v) for v in per.values())
        genome = sum(int(unit_rows[u]["length"]) for u in units if unit_rows[u]["hap"] == haps[0])
        base = sp.split("_")[0]
        row = {
            "id": sp, "name": species_name(sp, d), "group": group(sp), "copies": copies, "numbers": len(nums),
            "units": len(units), "genome": genome, "states": dict(states),
            "allelic": num(ps.get("allelic_distance_median")), "cross": num(ps.get("cross_chrom_distance_median")),
            "pairs": len(pairs), "fusions": len({f["components"] for f in fusions if f.get("status") == "fusion"}),
            "homeoFrac": num(hms.get("duplicated_frac")), "homeoPairs": num(hms.get("n_partner_pairs"), int),
            "windowed": bool(win),
            "teMean": round(sum(x[2] for x in data["te"] if x[2] is not None) / len(tei), 3) if tei else None,
            "tes": tes,
            "answers": answers(d), "category": cat.get(sp), "lit": clean_lit(lit.get(base)),
            "note": NOTES.get(sp),
        }
        if sp in PARTS:
            row["parent"], row["part"] = PARTS[sp]
            row["note"] = None
        panel.append(row)
        print(f"{sp:16} {row['name']:28} {copies}x{len(nums):<3} windows {len(win):>3}  "
              f"{(outdir / f'{sp}.json').stat().st_size / 1e6:.2f} MB")
    index = {"commit": git("rev-parse", "HEAD"), "committed": git("log", "-1", "--format=%cI"), "species": panel}
    Path(args.out, "ploidy.json").write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(panel)} runs -> {args.out}/ploidy.json and {outdir}/")


if __name__ == "__main__":
    main()
