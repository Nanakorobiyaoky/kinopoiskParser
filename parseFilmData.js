const puppeteer = require('puppeteer-extra');
const fs = require("fs");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const startYear = 2012;         //1990
const endYear = 2022;           //2022
const startIndex = 10            // 11
const endIndex = 10            // 199

async function removeCopyrightImg(page) {
    await page.evaluate(() => {
        let a = document.querySelector('.styles_copyrightImg__LB6H4')
        if (a) a.remove()
    })
}

async function makePosterScreenShot(page, name) {
    const element = await page.$('.film-poster')
    const box = await element.boundingBox();

    const x = box['x'];
    const y = box['y'];
    const w = box['width'];
    const h = box['height'];

    await page.screenshot({
        'path': `./parsedFilms/filmPosters/${name}.webp`,
        'clip': {'x': x, 'y': y, 'width': w, 'height': h}
    })
}

async function makePersonScreenShot(page, name) {
    const element = await page.$('.styles_image__lSxoD')
    const box = await element.boundingBox();

    const x = box['x'];
    const y = box['y'];
    const w = box['width'];
    const h = box['height'];

    await page.screenshot({
        'path': `./parsedFilms/actorImages/${name}.webp`,
        'clip': {'x': x, 'y': y, 'width': w, 'height': h}
    })
}

async function wait(page, seconds) {
    await page.waitForTimeout(Math.floor((Math.random() + seconds) * 1000));
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        userDataDir: 'C:/Users/Admin/AppData/Local/Google/Chrome/User Data',
        defaultViewport: {width: 1920, height: 1080},

    });

    for (let year = startYear; year <= endYear; year++) {

        const links = JSON.parse(fs.readFileSync(`./filmLinks/${year}.json`, 'utf8'));

        for (let i = startIndex; i <= endIndex; i++) {
            const link = links.at(i)
            const idKinopoisk = +link.split('/').at(-2);

            const page = await browser.newPage();
            await page.goto(link);

            await page.waitForSelector('div[data-test-id="encyclopedic-table"]');

            const film = await page.evaluate(() => {
                const requiredData = [
                    'Год производства',
                    'Страна',
                    'Жанр',
                    'Слоган',
                    'Бюджет',
                    'Премьера в мире',
                    'Возраст',
                    'Рейтинг MPAA',
                    'Время',
                ];

                const rating = parseFloat(document.querySelector('.film-rating-value').innerText)
                const marks = parseInt(document.querySelector('.styles_countBlock__jxRDI').innerText.replace(' ', ''));
                let [name_ru, name_en] = document.querySelector('.styles_title__hTCAr').innerText.split('\n')
                const description = document.querySelector('.styles_paragraph__wEGPz').innerText

                name_ru = name_ru.replace(/(.+?) ?\([0-9]+\)/ig, '$1')
                name_en = name_en.replace(/(.+?)[0-9](.+)/ig, '$1')

                const table = document.querySelector('div[data-test-id="encyclopedic-table"]');
                const arr = Array.from(table.querySelectorAll('div[data-tid="7cda04a5"]'))
                    .map(x => {
                        return x.innerText.split('\n').slice(0, 2);
                    })
                    .filter(x => {
                        return requiredData.includes(x.at(0))
                    })

                const data = {}

                for (let i of arr) {
                    data[i.at(0)] = i.at(1)
                }

                data['Год производства'] = +data['Год производства']
                data['Страна'] = data['Страна'].split(', ')
                data['Жанр'] = data['Жанр'].split(', ')
                data['Премьера в мире'] = data['Премьера в мире'].replace(/(.+),(.+)/, '$1')

                const result = {
                    year: data['Год производства'],
                    country: data['Страна'],
                    genre: data['Жанр'],
                    tagline: data['Слоган'],
                    budget: data['Бюджет'],
                    worldPremier: data['Премьера в мире'],
                    age: data['Возраст'],
                    MPAA: data['Рейтинг MPAA'],
                    time: data['Время'],
                    rating: rating,
                    marks: marks,
                    description: description,
                    name_ru: name_ru,
                    name_en: name_en
                }

                return result

            });

            console.log('===========================')
            console.log(idKinopoisk, i, film.name_ru, year)

            film.idKinopoisk = idKinopoisk
            film.poster = `${idKinopoisk}.webp`

            await removeCopyrightImg(page);
            await makePosterScreenShot(page, idKinopoisk)

            const castPage = await browser.newPage()
            await page.close()
            await castPage.goto(link + 'cast/who_is/')
            await castPage.waitForSelector('.block_left')

            const castLinks = await castPage.evaluate(() => {
                return Object.values(document.querySelectorAll('.all')).map(x => x.href).slice(1, -1)
            })

            for (let castLink of castLinks) {

                const role = castLink.split('/').at(-2);

                const rolePersonsPage = await browser.newPage();
                await rolePersonsPage.goto(castLink);
                await rolePersonsPage.waitForSelector('.block_left');

                const personLinks = await rolePersonsPage.evaluate(() => {
                    return Object.values(document.querySelectorAll('div.info > div.name > a')).map(x => x.href);
                })

                await rolePersonsPage.close();
                film[role] = [];
                console.log(role);

                for (let personLink of personLinks) {
                    const personPage = await browser.newPage();
                    await personPage.goto(personLink);
                    await personPage.waitForSelector('.styles_table__p64a3')
                    await personPage.waitForSelector('.styles_image__lSxoD')

                    const personId = +personLink.split('/').at(-2);

                    const [personData, imageUrl] = await personPage.evaluate(() => {
                            const dataArray =  Object.values(document.querySelectorAll('div[data-tid="7cda04a5"]')).map(x => x.innerText)
                            const imageUrl = document.querySelector('.styles_image__lSxoD').srcset

                            const result = {}

                            const [name_ru, name_en] = document.querySelector('.styles_wrapper__Cth9w').innerText.split('\n')
                            result.name_ru = name_ru
                            result.name_en = name_en

                            for (let elem of dataArray) {
                                const data = elem.split('\n').at(-1)
                                const inputData = data === '—' ? null : data
                                if (elem.startsWith('Рост')) {
                                    result.height = inputData
                                } else if (elem.startsWith('Дата рождения')) {
                                    result.birthday = inputData
                                } else if (elem.startsWith('Место рождения')) {
                                    result.PlaceOfBirth = inputData
                                } else if (elem.startsWith('Супруг')) {
                                    result.Spouse = inputData
                                }
                            }

                            return [result, imageUrl]
                        })

                    personData.IdKinopoisk = personId;
                    console.log(personId, personData.name_ru)

                    if (!imageUrl) {
                        personData.image = null
                    } else {
                        await makePersonScreenShot(personPage, personId)
                        personData.image = `${personData.IdKinopoisk}.webp`
                    }

                    film[role].push(personData)

                    await personPage.close()
                }

            }

            await castPage.close()

            fs.writeFile(`./parsedFilms/${idKinopoisk}.json`, JSON.stringify(film, null, 2), (error) => {
                if (error) console.log(error.message)
            });

        }

    }

    await browser.close()
})();


