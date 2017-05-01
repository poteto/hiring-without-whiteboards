'use strict'

const fs = require('fs');
const cheerio = require('cheerio');
const Bluebird = require('bluebird');

const request = Bluebird.promisify(require("request"), { multiArgs: true });
Bluebird.promisifyAll(request, { multiArgs: true });

const normalizeUrl = (u) => {
  if (u.indexOf('https://') > -1) {
    u = u.split('https://')[1];
  } else {
    u = u.split('http://')[1];
  }

  if (u.indexOf('www.') > -1) {
    u = u.split('www.')[1];
  }

  if (u.indexOf('/') > -1) {
    u = u.split('/')[0]
  }

  return u;
}

const sortByRanking = (arr) => {
  const sorted = arr.sort((a, b) => {
    if (!a.rankingNum || ['github.com', 'docs.google.com'].indexOf(a.normalizedUrl) > -1) {
      return 1;
    }

    if (!b.rankingNum || ['github.com', 'docs.google.com'].indexOf(b.normalizedUrl) > -1) {
      return -1;
    }

    return a.rankingNum - b.rankingNum;
  });

  return sorted;
}

const companies = [];
request('https://github.com/poteto/hiring-without-whiteboards').then((res) => {
  const body = res[0].body;
  const $ = cheerio.load(body);
  $('.markdown-body.entry-content ul li a').each((i, el) => {
    const comp = {
      title: $(el).text(),
      url: $(el).attr('href')
    };

    companies.push(comp);
  });

  const companiesWithRankings = [];

  Bluebird.map(companies, (c) =>
    request(`http://www.alexa.com/siteinfo/${normalizeUrl(c.url)}`)
    .then((_res) => {
      const _body = _res[0].body;
      const _$ = cheerio.load(_body);
      const rankingStr = _$('.globleRank .metrics-data').text().trim();
      const rankingNum = parseInt(rankingStr.replace(',', '').replace(' ', ''), 10);
      const obj = {
        company_title: c.title,
        url: c.url,
        normalizedUrl: normalizeUrl(c.url),
        rankingStr,
        rankingNum
      };

      companiesWithRankings.push(obj);
      if (companiesWithRankings.length % 10 === 0) {
        const sorted = sortByRanking(companiesWithRankings);
        fs.writeFile(`${__dirname}/output.json`, JSON.stringify(sorted, null, 2));
        console.log(`${companiesWithRankings.length} / ${companies.length} completed.`);
      }

      return obj;
    })
    .catch(err => console.log(err)), { concurrency: 3 })
  .then(() => {
    const sorted = sortByRanking(companiesWithRankings);
    fs.writeFile(`${__dirname}/output.json`, JSON.stringify(sorted, null, 2));
    console.log(`Task completed.`);
  });

});
