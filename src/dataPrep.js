
// Load and parse data (wide -> objects with year maps)
async function loadDataLong() {
  const rows = await d3.csv("../data/processed_data.csv", d => ({
    code: d.REF_AREA,
    country: d.REF_AREA_LABEL,
    region: d.continent,
    year: +d.year,
    factor: d.factor,        // "gdp" | "pm25" | "pop"
    value: +d.value
  }));

  // group by country
  const byCountry = d3.group(rows, d => d.country);

  const countries = [];
  for (const [country, arr] of byCountry) {
    const obj = { country, region: arr[0].region || "Other", gdp: {}, pm25: {}, pop: {} };

    arr.forEach(r => {
      if (r.factor === "gdp") obj.gdp[r.year] = r.value;
      if (r.factor === "pm25") obj.pm25[r.year] = r.value;
      if (r.factor === "pop") obj.pop[r.year] = r.value;
    });

    countries.push(obj);
  }

  return countries;
}


// return array of plottable points for a year
function getDataForYear(countries, year) {
  return countries
    .map(c => ({
      country: c.country,
      region: c.region || "Other",
      gdp: c.gdp[year] || 0,
      pm25: c.pm25[year] || 0,
      population: c.pop[year] || 0
    }))
    .filter(d => d.gdp > 0 && d.pm25 > 0 && d.population > 0);
}

// compute global domains across all years & countries
function computeGlobalDomains(countries) {
  const flat = [];
  countries.forEach(c => {
    Object.keys(c.gdp).forEach(year => {
      flat.push({
        gdp: c.gdp[year],
        pm25: c.pm25[year],
        population: c.pop[year]
      });
    });
  });

  return {
    GDP_MIN: d3.min(flat, d => (d.gdp > 0 ? d.gdp : null)),
    GDP_MAX: d3.max(flat, d => d.gdp),
    PM25_MAX: d3.max(flat, d => d.pm25),
    POP_MAX: d3.max(flat, d => d.population)
  };
}

// create global scales (fixed for every year)
function makeGlobalScales(width, height, margin, domains) {
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3.scaleLog()
    .domain([domains.GDP_MIN, domains.GDP_MAX])
    .range([0, innerWidth])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([0, domains.PM25_MAX])
    .range([innerHeight, 0])
    .nice();

  const rScale = d3.scaleSqrt()
    .domain([0, domains.POP_MAX])
    .range([2, 40]);

  return { xScale, yScale, rScale };
}
