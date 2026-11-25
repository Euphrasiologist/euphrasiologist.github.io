#!/usr/bin/env python3
"""Build data/organelles.json, the species index for /organelles.html.

The index is small: per species and organelle, the QC summary, a few graph
statistics, an annotation summary (genes, spliced and trans-spliced genes,
predicted RNA edits, frameshifts) and the run prefix that locates its files.
The page reads the graphs (GFA) and annotation (GFF3) for a species straight
from the database repo, pinned to the commit the index was built from, so the
index and the files always agree.

The annotation summary needs every merged GFF3, so the build reads a local
clone. Without --src it makes a blobless, sparse one (about 250 MB) itself.

Usage: python3 scripts/build_organelle_index.py [--src <clone>] [--out data/organelles.json]
Set GITHUB_TOKEN to avoid the unauthenticated API rate limit.
"""

import argparse
import csv
import io
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

REPO = "ARU-life-sciences/plant_organelle_database"
BRANCH = "main"
ORGS = {"mito": "mito", "pltd": "plastid"}  # file suffix -> data/ folder


SPARSE = [
    "/analysis/gff_export/results/*.gff",
    "/analysis/editing/results/*.tsv",
    "/analysis/qc_basic_stats/results/*.tsv",
]


def get(url, tries=4):
    req = urllib.request.Request(url, headers={"User-Agent": "euphrasiologist.com index builder"})
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for k in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or k == tries - 1:
                raise
            time.sleep(5 * (k + 1))


def git(src, *args):
    return subprocess.run(["git", "-C", src, *args], check=True, capture_output=True, text=True).stdout


def clone(dest):
    subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout",
                    f"https://github.com/{REPO}", dest], check=True)
    git(dest, "sparse-checkout", "set", "--no-cone", *SPARSE)
    git(dest, "checkout", "-q", BRANCH)


def tsv(src, path):
    with open(os.path.join(src, path)) as f:
        return list(csv.DictReader(f, delimiter="\t"))


def num(v, cast=float):
    try:
        return cast(float(v))
    except (TypeError, ValueError):
        return None


def gff_summary(path):
    """Gene, splicing, editing and frameshift counts from one merged GFF3.

    As on the page, where a gene has an edited or reconstructed model the raw
    hits for it are set aside, so a gene counts once, at its best model.
    Trans-splicing is poa's own call: exception=trans-splicing on a model with
    a trans or other-contig junction."""
    feats, kids = {}, defaultdict(list)
    with open(path) as f:
        for line in f:
            if line[0] == "#":
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 9:
                continue
            a = dict(kv.split("=", 1) for kv in c[8].split(";") if "=" in kv)
            rec = {"seq": c[0], "type": c[2], "start": int(c[3]), "end": int(c[4]), "strand": c[6], **a}
            if c[2] in ("CDS", "exon", "sequence_alteration", "frameshift"):
                kids[a.get("Parent")].append(rec)
            elif "ID" in a:
                feats[a["ID"]] = rec
    genes = defaultdict(list)
    for r in feats.values():
        if r["type"] == "gene" and r.get("Name"):
            genes[r["Name"]].append(r)
    tx = defaultdict(list)  # gene ID -> its mRNA/tRNA/rRNA
    for r in feats.values():
        if r["type"] in ("mRNA", "tRNA", "rRNA") and r.get("Parent"):
            tx[r["Parent"]].append(r)
    out = {"genes": 0, "spliced": 0, "trans": 0, "editedGenes": 0, "edits": 0, "uc": 0,
           "frameshifts": 0, "fsGenes": 0, "internalStops": 0, "transGenes": []}
    for name, models in genes.items():
        better = [g for g in models if g.get("annotation_tier", "raw") != "raw"]
        kept = better or models
        out["genes"] += 1
        spliced = trans = edited = fs = stops = False
        for g in kept:
            trans |= g.get("exception") == "trans-splicing"
            for t in tx[g["ID"]]:
                exons = sorted((e for e in kids[t["ID"]] if e["type"] in ("CDS", "exon")),
                               key=lambda e: int(e.get("exon_number", 0)))
                if int(t.get("n_exons", 0) or 0) > 1 or len({(e["start"], e["end"]) for e in exons}) > 1:
                    spliced = True
                cds = {e["ID"] for e in exons if "ID" in e}
                alts = [k for i in cds for k in kids[i] if k["type"] == "sequence_alteration"]
                shifts = [k for i in cds for k in kids[i] if k["type"] == "frameshift"]
                sites = {(k["seq"], k["start"]) for k in alts}
                out["edits"] += len(sites)
                out["uc"] += len({(k["seq"], k["start"]) for k in alts if k.get("edited_from") == "T"})
                out["frameshifts"] += len({(k["seq"], k["start"]) for k in shifts})
                edited |= bool(sites)
                fs |= bool(shifts)
                stops |= int(t.get("n_internal_stops", 0) or 0) > 0
        out["spliced"] += spliced
        out["trans"] += trans
        if trans:
            out["transGenes"].append(name)
        out["editedGenes"] += edited
        out["fsGenes"] += fs
        out["internalStops"] += stops
    out["transGenes"].sort()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/organelles.json")
    ap.add_argument("--src", help="a clone of the database (sparse is fine); made in a temp dir if omitted")
    args = ap.parse_args()
    if args.src:
        build(args.src, args.out)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            clone(os.path.join(tmp, "db"))
            build(os.path.join(tmp, "db"), args.out)


def build(src, out_path):
    sha = git(src, "rev-parse", "HEAD").strip()
    committed = git(src, "show", "-s", "--format=%cI", "HEAD").strip()
    committed = datetime.fromisoformat(committed).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    # File sizes from the API: a blobless clone would have to fetch every blob
    tree = json.loads(get(f"https://api.github.com/repos/{REPO}/git/trees/{sha}?recursive=1"))
    if tree.get("truncated"):
        raise SystemExit("the repository tree listing was truncated")
    paths = {x["path"]: x.get("size", 0) for x in tree["tree"] if x["type"] == "blob"}
    lineage = {r["species"]: r["lineage"] for r in tsv(src, "analysis/editing/results/lineage.tsv")}

    # The run prefix for each species and organelle: the top-level GFA in its
    # data folder (superseded runs sit in a subfolder). Where two runs sit side
    # by side, keep the larger, as an empty failed rerun is the usual culprit.
    runs = {}
    for p, size in paths.items():
        m = re.match(r"data/(mito|plastid)/([^/]+)/([^/]+)\.(mito|pltd)\.gfa$", p)
        if not m:
            continue
        key = (m[2], m[4])
        if key not in runs or size > runs[key][1]:
            runs[key] = (m[3], size)

    def has(p):
        return p in paths and paths[p] > 0

    qc = {(r["species"], r["organelle"]): r for r in tsv(src, "analysis/qc_basic_stats/results/qc_summary.tsv")}
    graph = defaultdict(lambda: {"nodes": 0, "edges": 0, "gc": [], "cov": []})
    for r in tsv(src, "analysis/qc_basic_stats/results/gfa_stats.tsv"):
        if r.get("parse_status") != "ok":
            continue
        g = graph[(r["species"], r["organelle"])]
        g["nodes"] += num(r["n_nodes"], int) or 0
        g["edges"] += num(r["n_edges"], int) or 0
        length = num(r["total_length"]) or 0
        if num(r["gc_content"]) is not None:
            g["gc"].append((num(r["gc_content"]), length))
        if num(r["avg_coverage"]) is not None:
            g["cov"].append((num(r["avg_coverage"]), length))
    genes = defaultdict(set)
    for org in ORGS:
        for r in tsv(src, f"analysis/qc_basic_stats/results/gene_matrix_{org}.tsv"):
            if (num(r.get("n_hits")) or 0) > 0:
                genes[(r["species"], org)].add(r["gene"])

    def wmean(pairs):
        total = sum(w for _, w in pairs)
        return round(sum(v * w for v, w in pairs) / total, 4) if total else None

    annot = {}
    for sp, org in qc:
        gff = os.path.join(src, f"analysis/gff_export/results/{sp}.{org}.gff")
        if os.path.exists(gff) and os.path.getsize(gff):
            a = gff_summary(gff)
            if a["genes"]:
                annot[(sp, org)] = {k: v for k, v in a.items() if v}

    species = {}
    for (sp, org), q in sorted(qc.items()):
        run = runs.get((sp, org))
        g = graph.get((sp, org))
        prefix = run[0] if run else None
        folder = f"data/{ORGS[org]}/{sp}/{prefix}" if prefix else None
        entry = {
            "status": q["status"] or None,
            "reasons": [s for s in (q["status_reasons"] or "").split(";") if s] or None,
            "length": num(q["total_length"], int),
            "subgraphs": num(q["n_subgraphs"], int),
            "circular": {"True": True, "False": False}.get(q["any_circular"]),
            "deadEnds": num(q["dead_end_nodes"], int),
            "contigs": num(q["n_contigs"], int),
            "coreGenes": round(num(q["core_gene_pct"]), 3) if num(q["core_gene_pct"]) is not None else None,
            "crossOrganelle": round(num(q["cross_organelle_aligned_frac"]), 3) if num(q["cross_organelle_aligned_frac"]) is not None else None,
            "nodes": g["nodes"] if g else None,
            "edges": g["edges"] if g else None,
            "gc": wmean(g["gc"]) if g else None,
            "depth": round(wmean(g["cov"]), 1) if g and g["cov"] else None,
            "genes": len(genes[(sp, org)]) or None,
            "annot": annot.get((sp, org)),
            "prefix": prefix,
            "files": [k for k, p in {
                "gfa": f"{folder}.{org}.gfa",
                "fasta": f"{folder}.{org}.ctg.fasta",
                "bed": f"{folder}.{org}.bed",
                "annot": f"{folder}.annot_{org}.txt",
                "gff": f"analysis/gff_export/results/{sp}.{org}.gff",
                "ugff": f"analysis/gff_export/results/unitig/{sp}.{org}.unitig.gff",
                "png": f"analysis/topology_plots/results/plots/{org}/{sp}.genes.png",
            }.items() if folder and has(p)] if folder else [],
        }
        species.setdefault(sp, {})[org] = {k: v for k, v in entry.items() if v is not None and v != []}
        if sp in lineage:
            species[sp]["lineage"] = lineage[sp]

    out = {
        "repo": REPO,
        "commit": sha,
        "committed": committed,
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "species": species,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(species)} species from {REPO}@{sha[:7]} -> {out_path} ({os.path.getsize(out_path) / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
