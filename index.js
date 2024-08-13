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
async function scroll( page, seconds ) {
    return new Promise( ( resolve ) => {
        let i = 1;
        const int = setInterval( () => {
            i++;
            page.evaluate( ( top ) => {
                window.scrollTo( { top, behavior: 'smooth' } )
            }, 40 * i );
        }, 500 );
        setTimeout( () => {
            clearInterval( int );
            resolve();
        }, seconds * 1000 )
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

async function makeFrame( page, title, mobile, action = 'scroll' ) {
    const prefix = mobile ? '.m.' : '.';
    const url = `https://en${prefix}wikipedia.org/wiki/${title}`;
    console.log(`Goto ${url}`);
    switch ( action ) {
        case 'search':
            await search( page, title );
            break;
        default:
            await page.goto(url);
            await scroll( page, 2 );
            break;
    }  
    return Promise.resolve();
}

async function run( year ) {
    const pages = await getTopArticlesForYear( year, /* country doesnt work yet */ )
    const browser = await puppeteer.launch( { args: [ '--no-sandbox' ] } );
    const page = await browser.newPage();
    const SavePath = `./tmp/final.mp4`;
    const recorder = new PuppeteerScreenRecorder(page);
    await page.goto( 'https://www.wikipedia.org/' );
    await recorder.start(SavePath);
    await sleep( 2 );
    await start( page, year );
    for ( let i = 0; i < pages.length; i++ ) {
        console.log(`Make frame ${i}`);
        const isMobile = true; //Math.random() < 0.5;
        const action = i < 5 ? 'search' : 'scroll';
        await makeFrame( page, pages[i], isMobile, action );
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
