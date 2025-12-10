// Load and parse data - keeps wide format structure
async function loadData() {
    try {
        const data = await d3.csv("../data/processed_data.csv");
        
        // Parse the data and organize by type (gdp, pm25, pop)
        const countries = [];
        
        data.forEach(row => {
            const countryData = {
                country: row.REF_AREA_LABEL || row.country,
                gdp: {},
                pm25: {},
                pop: {}
            };
            
            // Extract all year-based columns
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
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// Get scales for the visualization
function getScales(dataForYear, width, height, margin) {
    // X Scale: GDP (log scale)
    const xScale = d3.scaleLog()
        .domain([
            d3.min(dataForYear, d => d.gdp > 0 ? d.gdp : 1),
            d3.max(dataForYear, d => d.gdp)
        ])
        .range([margin.left, width - margin.right])
        .nice();
    
    // Y Scale: PM2.5 (linear scale)
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(dataForYear, d => d.pm25)])
        .range([height - margin.bottom, margin.top])
        .nice();
    
    // R Scale: Population (sqrt scale)
    const rScale = d3.scaleSqrt()
        .domain([0, d3.max(dataForYear, d => d.population)])
        .range([2, 40]);
    
    return { xScale, yScale, rScale };
}

// Filter data for a specific year and convert to plottable format
function getDataForYear(countries, year) {
    return countries
        .map(c => ({
            country: c.country,
            gdp: c.gdp[year] || 0,
            pm25: c.pm25[year] || 0,
            population: c.pop[year] || 0
        }))
        .filter(d => d.gdp > 0 && d.pm25 > 0 && d.population > 0);
}

// Main initialization
loadData()
    .then(countries => {
        console.log('Data loaded:', countries.length, 'countries');

        //ENSURING DATA IS LOADED CORRECTLY
        console.log('Sample data for first country:', countries[0]);
        // Get available years from first country's gdp data
        const years = Object.keys(countries[0].gdp).sort();
        console.log('Available years:', years);
        
        // Example: Access GDP data for a country
        console.log('Example - USA GDP data:', countries.find(c => c.country === 'United States')?.gdp);
        
        // Plot data for the first year
        if (years.length > 0) {
            const dataForYear = getDataForYear(countries, years[0]);
            plotChart(dataForYear);
        }
    })
    .catch(error => {
        console.error('Failed to initialize:', error);
    });

function plotChart(data) {
    //plot logic
}