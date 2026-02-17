
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkSchema() {
    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cart_items';
    `);
        console.log("Cart Items columns:");
        console.log(result.rows);

        const ordersResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders';
    `);
        console.log("\nOrders columns:");
        console.log(ordersResult.rows);
    } catch (error) {
        console.error("Error checking schema:", error);
    } finally {
        process.exit();
    }
}

checkSchema();
