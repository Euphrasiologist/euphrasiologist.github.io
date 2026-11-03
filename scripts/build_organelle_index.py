#!/usr/bin/env python3
"""Build data/organelles.json, the species index for /organelles.html.

The index is small: per species and organelle, the QC summary, a few graph
statistics, gene counts and the run prefix that locates its files. The page
reads the graphs (GFA) and annotation (GFF3) for a species straight from the
database repo, pinned to the commit the index was built from, so the index and
the files always agree.

Usage: python3 scripts/build_organelle_index.py [--out data/organelles.json]
Set GITHUB_TOKEN to avoid the unauthenticated API rate limit.
"""

import argparse
import csv
import io
import json
import os
import re
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

REPO = "ARU-life-sciences/plant_organelle_database"
BRANCH = "main"
ORGS = {"mito": "mito", "pltd": "plastid"}  # file suffix -> data/ folder


def get(url, accept=None):
    req = urllib.request.Request(url, headers={"User-Agent": "euphrasiologist.com index builder"})
    if accept:
        req.add_header("Accept", accept)
    token = os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def tsv(sha, path):
    text = get(f"https://raw.githubusercontent.com/{REPO}/{sha}/{path}").decode()
    return list(csv.DictReader(io.StringIO(text), delimiter="\t"))


def num(v, cast=float):
    try:
        return cast(float(v))
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/organelles.json")
    args = ap.parse_args()

    commit = json.loads(get(f"https://api.github.com/repos/{REPO}/commits/{BRANCH}"))
    sha = commit["sha"]
    tree = json.loads(get(f"https://api.github.com/repos/{REPO}/git/trees/{sha}?recursive=1"))
    paths = {x["path"]: x.get("size", 0) for x in tree["tree"] if x["type"] == "blob"}

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

    qc = {(r["species"], r["organelle"]): r for r in tsv(sha, "analysis/qc_basic_stats/results/qc_summary.tsv")}
    graph = defaultdict(lambda: {"nodes": 0, "edges": 0, "gc": [], "cov": []})
    for r in tsv(sha, "analysis/qc_basic_stats/results/gfa_stats.tsv"):
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
        for r in tsv(sha, f"analysis/qc_basic_stats/results/gene_matrix_{org}.tsv"):
            if (num(r.get("n_hits")) or 0) > 0:
                genes[(r["species"], org)].add(r["gene"])

    def wmean(pairs):
        total = sum(w for _, w in pairs)
        return round(sum(v * w for v, w in pairs) / total, 4) if total else None

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

    out = {
        "repo": REPO,
        "commit": sha,
        "committed": commit["commit"]["committer"]["date"],
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "species": species,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(species)} species from {REPO}@{sha[:7]} -> {args.out} ({os.path.getsize(args.out) / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
