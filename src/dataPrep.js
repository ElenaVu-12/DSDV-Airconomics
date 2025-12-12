
// Load and parse data (wide -> objects with year maps)
async function loadData() {
  const data = await d3.csv("../data/processed_data.csv");

  const countries = [];

  data.forEach(row => {
    const countryData = {
      country: row.REF_AREA_LABEL || row.country,
      region: row.region || row.WB_REGION || row.Region || "Other",
      gdp: {},
      pm25: {},
      pop: {}
    };

    Object.keys(row).forEach(col => {
      const match = col.match(/^(gdp|pm25|pop)_(19\d{2}|20\d{2})$/);
      if (match) {
        const type = match[1];
        const year = match[2];
        countryData[type][year] = +row[col] || 0;
      }
    });

    countries.push(countryData);
  });

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
