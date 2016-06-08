# Incloak proxy list crawler
Periodically extracts proxy list data from the first page of the https://incloak.com/proxy-list/ listing. Data on this page is updated every 7 minutes. Therefore, it is sufficient to read this page every 7 minutes.
## Crawling algorithm
 - Read the page using http://phantomjs.org/ by the configurable timer;
 - Evaluate the data extractor;
 - List extracted entries;
   - Check proxy for format validness;
   - Check proxy hash in the cache which keeps them for one hour;
   - Publish proxy to the anonymous integration queue if not in cache;
   - Add proxy to cache if not there;
 - Close Phantom.js instance.