import { IMidaBroker } from "#brokers/IMidaBroker";
import { IMidaBrowser } from "#browsers/IMidaBrowser";
import { IMidaBrowserTab } from "#browsers/IMidaBrowserTab";
import { ChromiumBrowser } from "#browsers/chromium/ChromiumBrowser";
import { MidaForexPair } from "#forex/MidaForexPair";
import { MidaPosition } from "#position/MidaPosition";
import { MidaPositionDirectionType } from "#position/MidaPositionDirectionType";
import { MidaPositionDirectives } from "#position/MidaPositionDirectives";
import { MidaPositionStatusType } from "#position/MidaPositionStatusType";

export class BDSwissBroker implements IMidaBroker {
    // A reference to the browser used internally to navigate the website of the broker.
    private _browser: IMidaBrowser;

    // A list of browser tabs used to perform actions on the website of the broker.
    private _browserTabs: {
        [name: string]: IMidaBrowserTab;
    };

    private _accountMeta: any;
    private _loggedIn: boolean;

    private _positions: {
        [positionID: string]: MidaPositionDirectives;
    };

    public constructor () {
        this._browser = new ChromiumBrowser();
        this._browserTabs = {};
        this._loggedIn = false;
        this._positions = {};
    }

    public get loggedIn (): boolean {
        return this._loggedIn;
    }

    public async login (meta: any): Promise<boolean> {
        if (this._loggedIn) {
            return true;
        }

        try {
            await this._browser.open();

            const loginTab: IMidaBrowserTab = await this._browser.openTab();
            const loginURI: string = "https://dashboard.bdswiss.com/login";
            const emailInputSelector: string = "#email";
            const passwordInputSelector: string = "#password";

            await loginTab.goto(loginURI);
            await loginTab.waitForSelector(`${emailInputSelector},${passwordInputSelector}`);
            await loginTab.type(emailInputSelector, meta.email);
            await loginTab.type(passwordInputSelector, meta.password);

            await loginTab.evaluate(`(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5000));
            
                jQuery(document.getElementsByTagName("button")[3]).click();
            })();`);

            await new Promise((resolve: any): any => setTimeout(resolve, 10000));

            const isLoggedIn: boolean = await loginTab.evaluate(`(() => {
                return window.location.href === "https://dashboard.bdswiss.com/accounts";
            })();`);

            if (!isLoggedIn) {
                return false;
            }

            this._accountMeta = meta;
            this._loggedIn = true;
        }
        catch (error) {
            console.error(error);

            return false;
        }

        await this._loadTradeTab();
        await this._loadForexTab();
        await this._loadPositionsTab();

        return true;
    }

    public async openPosition (positionDirectives: MidaPositionDirectives): Promise<MidaPosition> {
        const tradeTab: IMidaBrowserTab = this._browserTabs.tradeTab;
        const forexPairText: string = `${positionDirectives.forexPair.baseCurrency.id}/${positionDirectives.forexPair.quoteCurrency.id}`;
        const amount: number = positionDirectives.lots * 100000;
        const searchTextBoxSelector: string = "#assetsSearchInput";
        const firstSearchResultSelector: string = ".select-assets__table .rt-table .rt-tbody > [role=rowgroup]:first-child";

        await tradeTab.type(searchTextBoxSelector, forexPairText);
        await tradeTab.click(firstSearchResultSelector);

        if (positionDirectives.direction === MidaPositionDirectionType.BUY) {
            const buyButtonSelector: string = ".select-assets__table .rt-table .rt-tbody > [role=rowgroup]:first-child button[data-cy=assetBuy]";

            await tradeTab.click(buyButtonSelector);
        }
        else {
            const sellButtonSelector: string = ".select-assets__table .rt-table .rt-tbody > [role=rowgroup]:first-child button[data-cy=assetSell]";

            await tradeTab.click(sellButtonSelector);
        }

        const amountTextBoxSelector: string = "[data-cy=Amount]";

        await tradeTab.click(amountTextBoxSelector, 3);
        await tradeTab.type(amountTextBoxSelector, amount.toString());

        if (positionDirectives.takeProfit) {
            const takeProfitCheckBoxSelector: string = "[data-cy=checkboxTakeProfit]";
            const takeProfitTextBoxSelector: string = "[data-cy=TakeProfit]";

            await tradeTab.click(takeProfitCheckBoxSelector);
            await tradeTab.click(takeProfitTextBoxSelector, 3);
            await tradeTab.type(takeProfitTextBoxSelector, positionDirectives.takeProfit.toString());
        }

        if (positionDirectives.stopLoss) {
            const stopLossCheckBoxSelector: string = "[data-cy=checkboxStopLoss]";
            const stopLossTextBoxSelector: string = "[data-cy=StopLoss]";

            await tradeTab.click(stopLossCheckBoxSelector);
            await tradeTab.click(stopLossTextBoxSelector, 3);
            await tradeTab.type(stopLossTextBoxSelector, positionDirectives.stopLoss.toString());
        }

        const placeTradeButtonSelector: string = "button[data-cy=placeTrade]";

        await tradeTab.click(placeTradeButtonSelector);
        await tradeTab.click(searchTextBoxSelector, 3);
        await tradeTab.type(searchTextBoxSelector, "");

        const positionNotificationSelector: string = ".Toastify .Toastify__toast-container .Toastify__toast--success .Toastify__toast-body:first-child";

        await tradeTab.waitForSelector(positionNotificationSelector);

        const positionID: string = await tradeTab.evaluate(`(() => {
            return window.document.querySelector("").innerText.split(" ")[3];
        })();`);

        this._positions[positionID] = positionDirectives;

        return this._getPositionByID(positionID);
    }

    public async getPositions (status: MidaPositionStatusType): Promise<MidaPosition[]> {
        return this._browserTabs.positionsTab.evaluate(`(() => {
            const positions = [];
            const rows = window.document.querySelectorAll("#positionsPaneContent .rt-tbody [role=rowgroup] [role=row]");
            
            for (const row of rows) {
                const columns = row.childNodes;
                const assetName = row.childNodes[1].innerText;
                
                if (!assetName || assetName.length < 3) {
                    continue;
                }
                
                positions.push({
                    assetName,
                    direction: columns[3].innerText,
                    profit: columns[5].innerText,
                    openPrice: columns[6].innerText,
                });
            }
            
            return positions;
        })();`);
    }

    public async getEquity (): Promise<number> {
        const forexTab: IMidaBrowserTab = this._browserTabs.forexTab;
        const plainEquity: any = await forexTab.evaluate(`(() => {
            return window.document.querySelector("[data-cy=equity]").innerText.trim().split(" ")[1].replace(/,/g, "");
        })();`);

        return parseFloat(plainEquity);
    }

    public async getForexPairPrice (forexPair: MidaForexPair): Promise<number> {
        const forexTab: IMidaBrowserTab = this._browserTabs.forexTab;
        const forexPairPrice: any = await forexTab.evaluate(`(() => {
            const forexPairRow = window.document.querySelector("[data-cy='${forexPair.id}']").parentNode.parentNode;
            
            return forexPairRow.querySelector(".rt-td:nth-child(5)").innerText.trim();
        })();`);

        return parseFloat(forexPairPrice);
    }

    public async logout (): Promise<boolean> {
        this._positions = {};

        return false;
    }

    private async _getPositionByID (id: string): Promise<MidaPosition | null> {
        const positionDirectives: MidaPositionDirectives = this._positions[id];
        const positionDescriptor: any = this._browserTabs.positionsTab.evaluate(`(() => {
            const rows = window.document.querySelectorAll("#positionsPaneContent .rt-tbody [role=rowgroup] [role=row]");
            
            for (const row of rows) {
                const columns = row.childNodes;
                const id = row.childNodes[2].innerText.trim();
                
                if (id === "${id}") {
                    return {
                        
                    };
                }
            }
            
            return null;
        })();`);
    }

    private async _loadTradeTab (): Promise<boolean> {
        try {
            const tradeTab: IMidaBrowserTab = await this._browser.openTab();

            await tradeTab.goto(`https://trade.bdswiss.com/?embedded=true&login=${this._accountMeta.accountID}`);

            this._browserTabs.tradeTab = tradeTab;
        }
        catch (error) {
            console.error(error);

            return false;
        }

        return true;
    }

    private async _loadForexTab (): Promise<boolean> {
        try {
            const forexTab: IMidaBrowserTab = await this._browser.openTab();
            const forexFilterSelector: string = "[data-cy=forex]";

            await forexTab.goto(`https://trade.bdswiss.com/?embedded=true&login=${this._accountMeta.accountID}`);
            await forexTab.waitForSelector(forexFilterSelector);
            await forexTab.click(forexFilterSelector);

            this._browserTabs.forexTab = forexTab;
        }
        catch (error) {
            console.error(error);

            return false;
        }

        return true;
    }

    private async _loadPositionsTab (): Promise<boolean> {
        try {
            const positionsTab: IMidaBrowserTab = await this._browser.openTab();
            const positionsButtonSelector: string = ".actions .actions__item:nth-child(2) > button";

            await positionsTab.goto(`https://trade.bdswiss.com/?embedded=true&login=${this._accountMeta.accountID}`);
            await positionsTab.waitForSelector(positionsButtonSelector);
            await positionsTab.click(positionsButtonSelector);

            this._browserTabs.positionsTab = positionsTab;
        }
        catch (error) {
            console.error(error);

            return false;
        }

        return true;
    }
}
