const CURRENT_MONTH = 7;

const filterOut = ( item ) => ![ 'Special:Search',
    'Taylor_Swift',
    'Indian_Premier_League',
    'Porno_y_helado',
    'WrestleMania_XL',
    'Facebook',
    'Jeffrey_Epstein',
    'Saltburn_(film)',
    'Griselda_Blanco',
    '2024_Indian_Premier_League',
    'Deaths_in_2024',
    'YouTube', 'Main_Page', 'Cleopatra', 'Pornhub', 'XXXTentacion', '.xxx',
    'Juneteenth', 'Indian_Premier_League',
].includes( item.article.replace( / /g, '_' ) ) && !item.article.includes(':')
&& !item.article.includes('List_of');

async function getTopArticlesForYear( year, country = null ) {
    const queries = [];
    for ( let i = 1; i <= CURRENT_MONTH; i++ ) {
        const iPadded = i < 10 ? `0${i}` : `${i}`;
        const url = country ?
            `https://wikimedia.org/api/rest_v1/metrics/pageviews/top-by-country/en.wikipedia.org/all-access/${year}/${iPadded}` :
            `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/${year}/${iPadded}/all-days`;

        queries.push(
            fetch( url )
                .then( ( r ) => r.json() )
        );
    }
    const sortByPageViews = ( page, page2 ) => page.views < page2.views ? 1 : -1;
    return Promise.all( queries ).then( ( results ) => {
        const pages = results.map( ( result ) => {
            return result.items[0].articles.sort( sortByPageViews ).filter( filterOut ).slice(0, 5);
        } ).reduce((result, array) => result.concat(array), []).map(( page ) => page.article);
        const pagesWithoutDuplicates = pages.filter( ( article, i ) => pages.indexOf( article ) === i)
        console.log( pagesWithoutDuplicates );
        return pagesWithoutDuplicates;
    } );
}

module.exports = getTopArticlesForYear;
