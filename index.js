const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const puppeteer = require('puppeteer');
const concat = require('ffmpeg-concat');
global.fetch = require( 'node-fetch' );
const getTopArticlesForYear = require( './getTopArticlesForYear' );

async function sleep( seconds ) {
    return new Promise( ( resolve ) => {
        setTimeout( () => {
            resolve();
        }, seconds * 1000 );
    } );
}

const visitedTitles = {};

const isVisited = ( title ) => {
    return visitedTitles[title.replace(/ /g, '_')];
};

const markVisited = ( title ) => {
    visitedTitles[title.replace(/ /g, '_')] = true;
}

const getUnvisitedTitles = ( titles ) => {
    return titles.filter((title) => !isVisited(title));
};

async function scanForConnectionsAndClick( page, titles ) {
    const selector = getUnvisitedTitles( titles ).map((a) => `.mw-parser-output a[title="${a.replace(/_/g, ' ')}"]`).join(',');
    try {
        const node = await page.$(selector);
        if ( node === null ) {
            console.log(`Found no links.` );
            return;
        }
        const titleProp = await node.getProperty('title');
        const titlePropValue = await titleProp.jsonValue();
        console.log(`Found ${titlePropValue} in article.`);
        await node.scrollIntoView( { behavior: 'smooth' } );
        await node.focus();
        await sleep( 3 );
        await Promise.all( [
            page.waitForNavigation(),
            node.click()
        ] );
        markVisited( titlePropValue );
        await sleep( 3 );
        console.log(` Visited ${titlePropValue}`);
        // keep scanning until cannot find any more!
        await scanForConnectionsAndClick( page, titles );
    } catch ( e ) {
        console.log( e );
        throw e;
    }
};

async function scroll( page, seconds, titles = [] ) {
    return new Promise( async ( resolve ) => {
        let i = 1;
        const int = setInterval( () => {
            i++;
            page.evaluate( ( top ) => {
                window.scrollTo( { top, behavior: 'smooth' } )
            }, 40 * i );
        }, 500 );
        sleep( seconds ).then( () => {
            clearInterval( int );
            resolve();
        } );
    } );
}

async function prepareSearch( page ) {
    const searchInputSelector = '#www-wikipedia-org #searchInput, .skin-minerva #searchInput, .skin-vector-2022 #p-search .cdx-button';
    await page.waitForSelector( searchInputSelector );
    await page.click( searchInputSelector );
    await sleep( 1 );
}

async function typeSearchTerm( page, term ) {
    const searchKeySelector = '.overlay .search-box input, #searchform .cdx-text-input, #www-wikipedia-org #searchInput';
    await page.evaluate( ( input ) => {
        document.querySelector( input ).value = '';
    }, searchKeySelector );
    await page.type( searchKeySelector, term, { delay: 120 } );
}

async function start( page, year ) {
    await prepareSearch( page );
    await typeSearchTerm( page, `What happened in ${year}?` );
}

async function search( page, title ) {
    await page.goto( 'https://www.wikipedia.org/' );
    await prepareSearch( page );
    await typeSearchTerm( page, title );
    const selector = '#searchform .cdx-menu-item:first-child a, .search-results-view ul li:first-child a, #typeahead-suggestions .suggestion-link:first-child';
    await sleep( 1 );
    await page.waitForSelector( selector );
    await Promise.all( [
        page.waitForNavigation(),
        page.click( selector )
    ] );
    await sleep( 1 );
}

async function makeFrame( page, title, mobile, action = 'scroll', pages = [] ) {
    const prefix = mobile ? '.m.' : '.';
    const url = `https://en${prefix}wikipedia.org/wiki/${title}`;
    console.log(`Goto ${url}`);
    markVisited( title );
    switch ( action ) {
        case 'search':
            console.log('search', title);
            await search( page, title );
            break;
        default:
            console.log('scroll', title);
            await page.goto(url);
            await scroll( page, 2, pages );
            break;
    }  
    return Promise.resolve();
}

function getAction( i ) {
    switch ( i ) {
        case 0:
            return 'search';
        default:
            return 'scroll';
    }
}

async function run( year ) {
    const titles = await getTopArticlesForYear( year, /* country doesnt work yet */ );
    titles.unshift( `${year}` );
    const browser = await puppeteer.launch( { args: [ '--no-sandbox' ] } );
    const page = await browser.newPage();
    const SavePath = `./tmp/final.mp4`;
    const recorder = new PuppeteerScreenRecorder(page);
    await page.goto( 'https://www.wikipedia.org/' );
    await recorder.start(SavePath);
    await sleep( 2 );
    await start( page, year );
    for ( let i = 0; i < titles.length; i++ ) {
        console.log(`Make frame ${i}`);
        const unvisited = getUnvisitedTitles( titles );
        if ( i > 0 ) {
            console.log('Scanning for pages');
            try {
                await scanForConnectionsAndClick( page, unvisited );
            } catch ( e ) {
                // no problemo
            }
        }
        const isMobile = Math.random() < 0.5;
        const title = titles[i];
        const action = getAction( i );
        if ( !isVisited( title ) ) {
            await makeFrame( page, title, isMobile, action, unvisited );
        } else {
            console.log(`Skip visited page ${title}`)
        }
    }
    await recorder.stop();  

    await concat({
        output: './output/final.mp4',
        audio: './input/audio.mp3',
        videos: [ './tmp/final.mp4' ],
        transition: {
            name: 'directionalWipe',
            duration: 50
        }
    });
    console.log('done');
    process.exit();
    
}
run( 2024 );
