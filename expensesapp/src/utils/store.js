
import {flow, types} from "mobx-state-tree";
import { createContext } from "react";
import SalaryModel from "./salaryStore";
import ThemeStore from "./themeStore";
import { getSalaryRow } from "./database_connector";


const Storage = types.model({
    salaryStore:types.optional(SalaryModel,{}),
    themeStore: types.optional(ThemeStore, {
    }),
}).actions(self=> ({
    pullFromDB:flow(function* (){
        const result = yield getSalaryRow();
        if(result!==null){
            console.log("Got results  ",result)
            self.salaryStore.setSalaryModel(
                result.amount,
                result.balance,
                result.last_deposit,
                result.currency,
                result.fixed === null ? null : Boolean(result.fixed),
                result.deposits_date,
                result.fixed_day,
                Boolean(result.setup_complete)
            );
            self.themeStore.setMode(result.theme_mode || "system");
        } else {
            self.themeStore.setMode("system");
        }

    }),
    setThemeOnStore(isDark){
        self.themeStore.setSystemTheme(isDark);
    },
    clear(){
        self.salaryStore.clear();
    }
}))

export const storage = Storage.create({});
export const Context = createContext();