#!/usr/bin/env python3
"""Build the telomere database behind /telomeres.html from a clone of
Euphrasiologist/tol_telomeres.

Writes:
  data/telomeres.json            species index (columnar), tree and transitions
  data/telomeres/seq/<sp>.json   per species: TR locus sequence and TERT CDS
  data/telomeres/telomeres.tsv   the index as one flat table
  data/telomeres/tr.fa           every TR locus
  data/telomeres/tert_cds.fa     every TERT coding sequence

Usage: python3 scripts/build_telomere_db.py --src path/to/tol_telomeres [--ena assemblies.tsv]

GenBank accessions come from ENA's chromosome-level assembly list, matched on the
assembly name (downloaded each run unless --ena gives a saved copy).
"""

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = "Euphrasiologist/tol_telomeres"
# tr_table.tsv `search` -> the run that holds that species' TR hits
HITS = {
    "tr_tol": "shifts/tr_tol/merged/outputs",
    "coleoptera": "shifts/tr_tol_col/merged/outputs",
    "hemiptera": "shifts/tr_tol_hem_cm/merged/outputs",
    "round4": "shifts/tr_tol_r4/merged/outputs",
}


ENA = ("https://www.ebi.ac.uk/ena/portal/api/search?result=assembly&query=assembly_level=%22chromosome%22"
       "&fields=accession,assembly_name,version&limit=0&format=tsv")


def accessions(path=None):
    """assembly name -> GCA accession.version, the latest version if a name has several"""
    if path:
        text = Path(path).read_text()
    else:
        with urllib.request.urlopen(ENA, timeout=600) as r:
            text = r.read().decode()
    best = {}
    for r in csv.DictReader(text.splitlines(), delimiter="\t"):
        v = int(r["version"] or 0)
        if r["assembly_name"] not in best or v > best[r["assembly_name"]][1]:
            best[r["assembly_name"]] = (r["accession"], v)
    return {k: f"{a}.{v}" for k, (a, v) in best.items()}


def table(path):
    with open(path) as f:
        return {r["species"]: r for r in csv.DictReader(f, delimiter="\t")}


def num(v, cast=float):
    try:
        return cast(float(v))
    except (TypeError, ValueError):
        return None


def fasta(path):
    out, name = [], None
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith(">"):
                name = line[1:]
                out.append([name, []])
            elif name is not None:
                out[-1][1].append(line.upper())
    return [(n, "".join(s)) for n, s in out]


def tandem_match(seq, unit):
    """Longest stretch of seq equal to the tandem of unit in some phase:
    (start, length). As in shifts/tr_hym/src/template_check.py."""
    n, best = len(unit), (None, 0)
    for start in range(len(seq)):
        for phase in range(n):
            if seq[start] != unit[phase]:
                continue
            k = 0
            while start + k < len(seq) and seq[start + k] == unit[(phase + k) % n]:
                k += 1
            if k > best[1]:
                best = (start, k)
    return best


def wrap(seq, width=60):
    return "\n".join(seq[i:i + width] for i in range(0, len(seq), width))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="clone of tol_telomeres")
    ap.add_argument("--out", default="data")
    ap.add_argument("--ena", help="saved copy of the ENA assembly list (else downloaded)")
    args = ap.parse_args()
    src = Path(args.src)
    out = Path(args.out)

    git = lambda *a: subprocess.run(["git", "-C", str(src), *a], capture_output=True, text=True).stdout.strip()
    commit, committed = git("log", "-1", "--format=%H"), git("log", "-1", "--format=%cI")

    summary = table(src / "outputs/summary.tsv")
    states = table(src / "shifts/repeat_evolution/repeat_states.tsv")
    trs = table(src / "shifts/tr_table.tsv")
    copies = table(src / "shifts/tr_copies/uniform/copies.tsv")
    gca = accessions(args.ena)
    assemblies, acc = {}, {}
    with open(src / "inputs/tol_latest_assemblies.txt") as f:
        for line in f:
            sp, path = line.rstrip("\n").split("\t")[:2]
            # the file name carries the haplotype (iyAbiAene1.hap1.1), as at NCBI
            name = os.path.basename(path).split(".primary")[0]
            m = re.search(r"/assembly/curated/([^/]+)/", path)
            assemblies[sp] = name
            acc[sp] = gca.get(name) or (gca.get(m[1]) if m else None)
    newick = (src / "shifts/tree/species_tree_dated.nwk").read_text().strip()
    # As in shifts/figures/fig1_d3/build_data.py
    transitions = [
        {
            "frm": r["frm"], "to": r["to"], "route": r["route"],
            "scope": r["scope"], "posterior": float(r["posterior"]),
            "distance": int(r["distance"]), "reversal": r["reversal"] == "True",
            "stem": float(r["stem_myr"]), "crown": float(r["crown_myr"]),
            "n_desc": int(r["n_desc"]), "tips": r["node_tips"].split(","),
            "group": r["group"].split(":")[-1],
        }
        for r in csv.DictReader(open(src / "shifts/repeat_evolution/b1_transitions.tsv"), delimiter="\t")
    ]
    losses = list(csv.DictReader(open(src / "shifts/d2_ends/loss_events.tsv"), delimiter="\t"))

    seqdir = out / "telomeres" / "seq"
    if seqdir.exists():
        shutil.rmtree(seqdir)
    seqdir.mkdir(parents=True)

    fields = ["species", "group", "phylum", "class", "order", "family", "assembly",
              "unit", "source", "support", "ends", "copies", "sequences", "t2t", "oneEnd", "noEnds",
              "topUnit", "topCopies", "state", "stateClass", "evidence", "flags", "note",
              "tert", "trLocus", "trModel", "trEvalue", "template", "templateMatch", "agrees",
              "trCopies", "validated", "gca", "seq"]
    rows, tr_fa, tert_fa = [], [], []
    names = sorted(set(summary) | set(states))
    n_tr = n_cds = 0
    for sp in names:
        s, st, t = summary.get(sp, {}), states.get(sp, {}), trs.get(sp, {})
        tax = st or t
        tr_seq = tr = None
        if t.get("tr_locus") not in (None, "", "none"):
            hits = src / HITS.get(t["search"], "") / f"{sp}.hits.fa"
            if hits.is_file():
                for name, seq in fasta(hits):
                    locus, model = name.split("|")[:2]
                    if locus == t["tr_locus"] and model == t["tr_model"]:
                        tr_seq = seq
                        break
        if tr_seq:
            unit = t.get("template_unit") or ""
            start, length = tandem_match(tr_seq, unit) if unit else (None, 0)
            tr = {"locus": t["tr_locus"], "model": t["tr_model"], "evalue": t["tr_evalue"], "seq": tr_seq}
            if unit and length >= len(unit) + 2:
                tr["template"] = [start, length, unit]
            tr_fa.append(f">{sp} {t['tr_locus']} model={t['tr_model']} evalue={t['tr_evalue']} "
                         f"validated={t['validated']}\n{wrap(tr_seq)}")
            n_tr += 1
        tert = None
        cds_path = src / "shifts/c6/cds" / f"{sp}.fa"
        if cds_path.is_file():
            recs = fasta(cds_path)
            if recs:
                header, cds = recs[0]
                parts = header.split()
                tert = {"locus": parts[1] if len(parts) > 1 else None,
                        "ref": parts[2] if len(parts) > 2 else None,
                        "cover": (parts[3].split("=")[1] if len(parts) > 3 and "=" in parts[3] else None),
                        "cds": cds}
                tert_fa.append(f">{header}\n{wrap(cds)}")
                n_cds += 1
        has = (1 if tr else 0) | (2 if tert else 0)
        if has:
            with open(seqdir / f"{sp}.json", "w") as f:
                json.dump({k: v for k, v in {"tr": tr, "tert": tert}.items() if v}, f, separators=(",", ":"))
        flags = [x for x in (st.get("flags") or "").split(";") if x]
        rows.append([
            sp, s.get("group") or None, tax.get("phylum") or None, tax.get("klass") or tax.get("class") or None,
            tax.get("order") or None, tax.get("family") or None, assemblies.get(sp),
            s.get("telomere_unit") or None, s.get("telomere_source") or None,
            st.get("support") or t.get("tidk_support") or None, st.get("ends") or None,
            num(s.get("telomere_copies"), int), num(s.get("sequences"), int), num(s.get("t2t"), int),
            num(s.get("one_end"), int), num(s.get("no_ends"), int),
            s.get("top_unit") or None, num(s.get("top_copies"), int),
            st.get("analysis_state") or None, st.get("state_class") or None, st.get("evidence") or None,
            flags or None, st.get("note") or None, st.get("tert") or None,
            None if t.get("tr_locus") in (None, "", "none") else t["tr_locus"],
            t.get("tr_model") or None, num(t.get("tr_evalue")), t.get("template_unit") or None,
            num(t.get("template_match"), int), t.get("agrees") or None,
            num((copies.get(sp) or {}).get("copies"), int) if copies.get(sp) else num(t.get("tr_copies"), int),
            t.get("validated") or None, acc.get(sp), has or None,
        ])

    index = {
        "repo": REPO, "commit": commit, "committed": committed,
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fields": fields, "rows": rows,
        "tree": newick, "transitions": transitions,
        "losses": [{k: (num(v) if k in ("n_species", "n_families", "crown_myr", "stem_myr", "telomere_strong") else v)
                    for k, v in r.items()} for r in losses],
    }
    with open(out / "telomeres.json", "w") as f:
        json.dump(index, f, separators=(",", ":"))

    flat = out / "telomeres" / "telomeres.tsv"
    with open(flat, "w", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(fields[:-1])
        for r in rows:
            w.writerow(["" if v is None else ";".join(v) if isinstance(v, list) else v for v in r[:-1]])
    (out / "telomeres" / "tr.fa").write_text("\n".join(tr_fa) + "\n")
    (out / "telomeres" / "tert_cds.fa").write_text("\n".join(tert_fa) + "\n")
    size = os.path.getsize(out / "telomeres.json") / 1e3
    print(f"{sum(1 for r in rows if r[-2])} with a GenBank accession")
    print(f"{len(rows)} species, {n_tr} TR loci, {n_cds} TERT CDS from {REPO}@{commit[:7]} "
          f"-> {out}/telomeres.json ({size:.0f} kB)")


if __name__ == "__main__":
    main()
