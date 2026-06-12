const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('file://' + __dirname + '/test-chart.html');
    await new Promise(r => setTimeout(r, 1000));
    const colors = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        let hasRed = false;
        let hasGreen = false;
        let hasBlue = false;
        canvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 200 && data[i+1] < 50 && data[i+2] < 50) hasRed = true;
                if (data[i] < 50 && data[i+1] > 200 && data[i+2] < 50) hasGreen = true;
                if (data[i] < 50 && data[i+1] < 50 && data[i+2] > 200) hasBlue = true;
            }
        });
        return { hasRed, hasGreen, hasBlue, numCanvases: canvases.length };
    });
    console.log("Colors found in canvases:", colors);
    await browser.close();
})();
