import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import getColors from '../utils/color-picker';
import CustomText from '../components/customText/customText';
import CustomButton from '../components/customButton/customButton';
import ScrollableTile from "../components/scrollableTile/scrollableTile.js"
import { getExpensesForMonth, getExpensesForToday } from '../utils/database_connector';
import { Context } from '../utils/store';

export default function MainScreen({ navigation }) {
    const {
        salaryStore:{
            amount,
            currentAmount,
            currency,
            deposits_date,
            fixed_day,
        },
    }=useContext(Context);
    const [todayExpenses, setTodayExpenses] = useState([]);
    const [monthExpenses, setMonthExpenses] = useState([]);

    useEffect(() => {
        const unsubscribe = navigation.addListener("focus", async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const today = await getExpensesForToday();
            setTodayExpenses(today);
            const monthData = await getExpensesForMonth(year, month);
            setMonthExpenses(monthData);
        });

        return unsubscribe;
    }, [navigation]);


    const getLastDayOfMonth = (year, month) => {
        return new Date(year, month, 0); // month is 1-based
    };
    const adjustIfWeekend = (date) => {
        const day = date.getDay(); // 0 = Sunday, 6 = Saturday

        if (day === 0) { // Sunday
            date.setDate(date.getDate() - 2);
        } else if (day === 6) { // Saturday
            date.setDate(date.getDate() - 1);
        }

        return date;
    };

    const getPreLastDayOfMonth = (year, month) => {
        const lastDay = getLastDayOfMonth(year, month);
        const preLast = new Date(lastDay);
        preLast.setDate(preLast.getDate() - 1);
        return adjustIfWeekend(preLast);
    };

    const calculateRemainingMonthMoney = (spentMonthList) => {
        if (
            amount == null ||
            !deposits_date ||
            !Array.isArray(spentMonthList)
        ) {
            return amount ?? 0;
        }

        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        let endDate;

        if (deposits_date === "Fixed date") {
            if (fixed_day == null) return amount;

            endDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                fixed_day
            );
            endDate = adjustIfWeekend(endDate);
        }

        else if (deposits_date === "Quincenal") {
            const day = today.getDate();

            if (day <= 15) {
                endDate = new Date(now.getFullYear(), now.getMonth(), 15);
            } else {
                endDate = getLastDayOfMonth(
                    now.getFullYear(),
                    now.getMonth() + 1
                );
            }

            endDate = adjustIfWeekend(endDate);
        }

        else if (deposits_date === "Pre last day of month") {
            endDate = getPreLastDayOfMonth(
                now.getFullYear(),
                now.getMonth() + 1
            );
        }

        else if (deposits_date === "Last day of month") {
            endDate = getLastDayOfMonth(
                now.getFullYear(),
                now.getMonth() + 1
            );
            endDate = adjustIfWeekend(endDate);
        }

        else {
            return amount;
        }

        const totalSpent = spentMonthList.reduce((sum, exp) => {
            // Extract day from label (last segment)
            const parts = exp.label.split(" - ");
            const dayStr = parts[parts.length - 1];
            const day = parseInt(dayStr, 10);

            if (Number.isNaN(day)) return sum;

            // Build expense date using current month/year
            const now = new Date();
            const expDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                day
            );

            if (expDate >= today && expDate <= endDate) {
                return sum + (exp.inflatedValue ?? exp.value ?? 0);
            }

            return sum;
        }, 0);


        return currentAmount - totalSpent;
    };






    const spentToday = todayExpenses.map(exp => ({
        id: exp.id,
        name: exp.name,
        value: exp.value,
        inflatedValue: exp.inflated_value,
        label: `${exp.name} - ${exp.inflated_value ?? exp.value} ${currency}`,
    }));
    const spentTodayLabels = spentToday.map(item => item.label);

    const spentMonth = monthExpenses.map(exp => {
        const dateObj = new Date(exp.date);
        const day = String(dateObj.getDate()).padStart(2, "0");

        return {
            id: exp.id,
            name: exp.name,
            value: exp.value,
            inflatedValue: exp.inflated_value,
            label: `${exp.name} - ${exp.inflated_value ?? exp.value} ${currency} - ${day}`,
        };
    });

    const spentMonthLabels = spentMonth.map(item => item.label);



    

  return (
    <View style={mainScreenStyles.container}>
        <View>
            <CustomText
                type='header1'
                text={`Expenses App`}
            />
            <CustomText
                type='header3'
                text={`Money available before next payment: ${calculateRemainingMonthMoney(spentMonth)} ${currency} `}
            />
            <View style={{flex:1,flexDirection:"row",marginTop:20,marginBottom:10}}>
                <CustomText
                    style={{flex:1,width:"100%"}}
                    type='header2'
                    text="Today's expenses"
                />
                <CustomButton
                    style={mainScreenStyles.buttonAdd}
                    text={"Add"}
                    type='secondary'
                    onPress={()=>{
                        navigation.navigate("Add today expense")
                    }}
                />
            </View>
            <ScrollableTile
                data={spentTodayLabels}
            />
            <View style={{flex:1,flexDirection:"row",marginTop:20,marginBottom:10}}>
                <CustomText
                    style={{flex:1,width:"100%"}}
                    type='header2'
                    text="This month's expenses"
                />
            </View>
            <ScrollableTile
                style={{marginBottom:60}}
                data={spentMonthLabels}
            />

        </View>
    </View>
  );
}

const mainScreenStyles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:-10,
        marginHorizontal:15,
    },
    headerText:{
        fontSize:20,
        color:getColors("header-01")
    },
    buttonAdd:{

    }
});
