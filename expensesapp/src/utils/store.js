
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
            self.salaryStore.setSalaryModel(result.amount,result.currency,false,result.deposits_date,result.fixed_day);
        }

    }),
    setThemeOnStore(isDark){
        self.themeStore.setSystemTheme(isDark);
    },
    clear(){
        self.salaryStore={};
    }
}))

export const storage = Storage.create({});
export const Context = createContext();