#!/usr/bin/env python3
"""Related end-satellite families, within and between species.

The rule of tol_telomeres shifts/d2_ends/satlib/src/summary.py (between): all-vs-all blastn of
the doubled consensus units, and two families are related if their best alignment covers >= 60%
of the longer period at >= 75% identity, counting only bases outside low-complexity sequence
(dustmasker) in both units. summary.py drops pairs from the same genome; here they are kept, so
the table also says which end families of one genome are variants of each other.

    python3 scripts/satellite_pairs.py --src <tol_telomeres clone> [--work DIR]

writes data/telomeres/satellite_pairs.tsv, which build_telomere_db.py reads. Needs blastn,
makeblastdb and dustmasker on PATH. It takes about half an hour on 8 threads; with --work, the
BLAST output there is reused.
"""
import argparse
import csv
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path

MIN_COV, MIN_ID = 0.6, 75.0


def dust(fa):
    """Low-complexity intervals (0-based, end exclusive) per sequence."""
    r = subprocess.run(["dustmasker", "-in", fa, "-outfmt", "interval"], capture_output=True, text=True, check=True)
    iv, name = defaultdict(list), None
    for line in r.stdout.splitlines():
        if line.startswith(">"):
            name = line[1:].split()[0]
        elif " - " in line:
            x, y = line.split(" - ")
            iv[name].append((int(x), int(y) + 1))
    return iv


def complex_bp(iv, a, b):
    return (b - a) - sum(max(0, min(b, y) - max(a, x)) for x, y in iv)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="clone of tol_telomeres")
    ap.add_argument("--out", default="data/telomeres/satellite_pairs.tsv")
    ap.add_argument("--work", help="working directory (kept, and its BLAST output reused)")
    ap.add_argument("--threads", default="8")
    args = ap.parse_args()
    lib_dir = Path(args.src) / "shifts/d2_ends/satlib"
    lib = list(csv.DictReader(open(lib_dir / "library.tsv"), delimiter="\t"))
    recs = {f"{r['species']}|{r['family']}": r["consensus"] for r in lib if r["consensus"]}
    per = {f"{r['species']}|{r['family']}": int(r["period"]) for r in lib}
    myr = {}
    for r in csv.DictReader(open(lib_dir / "between.tsv"), delimiter="\t"):
        if r["divergence_myr"] not in ("", "nan"):
            myr[r["species_a"], r["species_b"]] = myr[r["species_b"], r["species_a"]] = float(r["divergence_myr"])

    work = Path(args.work or tempfile.mkdtemp())
    work.mkdir(parents=True, exist_ok=True)
    fa, hits = work / "u.fa", work / "b.tsv"
    if not hits.is_file():
        with open(fa, "w") as fh:
            for k, v in recs.items():
                fh.write(f">{k}\n{v * 2}\n")
        subprocess.run(["makeblastdb", "-in", fa, "-dbtype", "nucl", "-out", work / "u"], check=True,
                       stdout=subprocess.DEVNULL)
        subprocess.run(["blastn", "-task", "blastn", "-query", fa, "-db", work / "u", "-evalue", "1e-5", "-dust", "no",
                        "-max_target_seqs", "100000", "-num_threads", args.threads, "-outfmt",
                        "6 qseqid sseqid pident length qstart qend sstart send", "-out", hits], check=True)
    iv = dust(fa)

    # best alignment by length per ordered pair, as summary.py
    best = {}
    with open(hits) as fh:
        for line in fh:
            q, s, pid, ln, qs, qe, ss, se = line.split()
            if q == s:
                continue
            need = MIN_COV * max(per[q], per[s])
            if int(ln) < need:
                continue
            ss, se = sorted((int(ss), int(se)))
            if complex_bp(iv[q], int(qs) - 1, int(qe)) < need or complex_bp(iv[s], ss - 1, se) < need:
                continue
            if (q, s) not in best or int(ln) > best[q, s][1]:
                best[q, s] = (float(pid), int(ln))
    pairs = {}
    for (q, s), (pid, ln) in best.items():
        if pid < MIN_ID:
            continue
        k = tuple(sorted((q, s)))
        if k not in pairs or pid > pairs[k][0]:
            pairs[k] = (pid, ln)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    n = defaultdict(int)
    with open(args.out, "w", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["family_a", "family_b", "relation", "identity", "aligned_bp", "period_a", "period_b",
                    "divergence_myr"])
        for (a, b), (pid, ln) in sorted(pairs.items()):
            sa, sb = a.split("|")[0], b.split("|")[0]
            rel = "within" if sa == sb else "between"
            n[rel] += 1
            w.writerow([a, b, rel, round(pid, 1), ln, per[a], per[b], "" if rel == "within" else myr.get((sa, sb), "")])
    print(f"{n['within']} related pairs within genomes, {n['between']} between species -> {args.out}")


if __name__ == "__main__":
    main()
