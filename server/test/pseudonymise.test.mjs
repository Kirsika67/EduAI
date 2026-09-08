import { createNameShield } from "../src/services/pseudonymise.js";

let fails = 0;
const check = (nimi, saadud, oodatud) => {
  const ok = saadud === oodatud;
  if (!ok) fails++;
  console.log(ok ? "  OK  " : " VIGA ", nimi, "\n        sain:  ", saadud, "\n        ootasin:", oodatud);
};

const s = createNameShield(["Mari Tamm", "Jaan Kask", "Marina Lepik"]);
console.log("Kilp aktiivne:", s.active, "| nimesid:", s.count, "\n");

// 1. Terve nimi
check("terve nimi", s.mask("Mari Tamm sai 45 punkti."), "[Õ1] sai 45 punkti.");

// 2. Ainult eesnimi
check("eesnimi", s.mask("Jaan vajab tuge."), "[Õ2] vajab tuge.");

// 3. Käändevorm — kõige olulisem test
check("käänded", s.mask("Andsin Marile ülesande ja Jaaniga rääkisin."),
      "Andsin [Õ1] ülesande ja [Õ2] rääkisin.");

// 4. Pikem nimi enne lühemat: "Marina" ei tohi muutuda "Mari"-ks
check("Marina != Mari", s.mask("Marina Lepik ja Mari Tamm."), "[Õ3] ja [Õ1].");

// 5. Tagasiasendus
check("tagasi", s.unmask("[Õ1] tuleb hästi toime, [Õ2] vajab abi."),
      "Mari Tamm tuleb hästi toime, Jaan Kask vajab abi.");

// 6. Tagasiasendus käändega
check("tagasi käändega", s.unmask("Soovitan [Õ1]-le lisaharjutust."),
      "Soovitan Marile lisaharjutust.");

// 7. Edasi-tagasi ei tohi nime kaotada
const algne = "Mari Tamm ja Jaan Kask.";
check("edasi-tagasi", s.unmask(s.mask(algne)), algne);

// 8. Ükski päris nimi ei tohi maskitud tekstis alles jääda
const maskitud = s.mask("Mari, Marile, Mari Tamm, Jaan, Jaanile, Marina Lepik, Kask");
const lekib = ["Mari", "Jaan", "Marina", "Tamm", "Kask", "Lepik"].filter((n) => maskitud.includes(n));
check("lekkeid pole", lekib.length ? `LEKIB: ${lekib.join(", ")} -> ${maskitud}` : "puhas", "puhas");

// 9. Väljalülitatuna ei tee midagi
process.env.AI_PSEUDONYMISE = "off";
const off = createNameShield(["Mari Tamm"]);
check("off lülitab välja", off.mask("Mari Tamm"), "Mari Tamm");

console.log(fails ? `\n${fails} TESTI KUKKUS LÄBI` : "\nKõik testid läbitud.");
process.exit(fails ? 1 : 0);
