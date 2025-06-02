import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const HYPERLIQUID_STATS_QUERY_ID = 5184581 // Default query

async function triggerAndRecordDuneQuery(
  cronJobInternalExecutionId: string, // In this manual context, it's just a unique ID for this manual trigger
  queryId: number,
  queryName: string,
) {
  // This function is adapted from daily-dune-sync/route.ts
  console.log(
    `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Attempting to trigger Dune query ID ${queryId}`,
  )
  try {
    const duneApiKey = process.env.DUNE_API_KEY
    if (!duneApiKey) {
      console.error(`[${cronJobInternalExecutionId}] manualTrigger (${queryName}): DUNE_API_KEY not found`)
      throw new Error("DUNE_API_KEY not found")
    }

    console.log(`[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Executing Dune query ${queryId}...`)
    const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
      method: "POST",
      headers: {
        "X-Dune-Api-Key": duneApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ performance: "medium" }),
    })

    const execResponseText = await execResponse.text()
    console.log(
      `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Dune execute response status: ${execResponse.status}, body: ${execResponseText.substring(0, 200)}`,
    )

    if (!execResponse.ok) {
      throw new Error(`Dune execute failed for ${queryName}: ${execResponse.status} - ${execResponseText}`)
    }

    let execData
    try {
      execData = JSON.parse(execResponseText)
    } catch (e) {
      throw new Error(`Dune execute response is not valid JSON for ${queryName}: ${execResponseText}`)
    }

    const duneExecutionId = execData.execution_id
    if (!duneExecutionId) {
      throw new Error(`Dune execute response missing execution_id for ${queryName}: ${execResponseText}`)
    }
    console.log(
      `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Dune execution_id received: ${duneExecutionId}`,
    )

    const insertPayload = {
      execution_id: duneExecutionId,
      query_id: queryId,
      status: "PENDING",
      cron_execution_id: cronJobInternalExecutionId, // Using the manual trigger's unique ID here
      created_at: new Date().toISOString(),
    }
    console.log(
      `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Attempting to insert into Supabase dune_executions:`,
      JSON.stringify(insertPayload),
    )

    const {
      data: insertData,
      error: insertError,
      status: insertStatus,
    } = await supabase.from("dune_executions").insert([insertPayload]).select()

    console.log(
      `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Supabase insert response - Status: ${insertStatus}, Error: ${JSON.stringify(insertError)}, Data: ${JSON.stringify(insertData)}`,
    )

    if (insertError) {
      console.error(
        `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Supabase insert failed. Status: ${insertStatus}, Error: ${JSON.stringify(insertError)}`,
      )
      throw new Error(
        `Supabase insert failed for ${queryName} (Dune exec_id ${duneExecutionId}): ${insertError.message} (Code: ${insertError.code}, Details: ${insertError.details}, Hint: ${insertError.hint})`,
      )
    }

    console.log(
      `[${cronJobInternalExecutionId}] manualTrigger (${queryName}): Supabase insert successful for Dune execution_id ${duneExecutionId}`,
    )
    return {
      success: true,
      dune_execution_id: duneExecutionId,
      message: `${queryName} query triggered (Dune Exec ID: ${duneExecutionId}) and Supabase record created successfully.`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : `Unknown error in manualTrigger for ${queryName}`
    console.error(`[${cronJobInternalExecutionId}] manualTrigger (${queryName}): CATCH BLOCK - Error: ${errorMsg}`)
    return {
      success: false,
      error: errorMsg,
    }
  }
}

export async function POST(request: NextRequest) {
  const manualExecutionId = `manual_dune_trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  try {
    const body = await request.json()
    const { password, query_id: queryIdFromRequest } = body

    if (password !== process.env.DEBUG_PASSWORD) {
      return NextResponse.json({ success: false, error: "Unauthorized: Invalid password." }, { status: 401 })
    }

    const queryIdToExecute = queryIdFromRequest ? Number(queryIdFromRequest) : HYPERLIQUID_STATS_QUERY_ID
    const queryName =
      queryIdToExecute === HYPERLIQUID_STATS_QUERY_ID ? "Hyperliquid Stats" : `Custom Query ${queryIdToExecute}`

    console.log(
      `[${manualExecutionId}] Manual Dune Query Trigger: Received request for query_id ${queryIdToExecute} (${queryName})`,
    )

    const result = await triggerAndRecordDuneQuery(manualExecutionId, queryIdToExecute, queryName)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        dune_execution_id: result.dune_execution_id,
        manual_execution_id: manualExecutionId,
        query_id_executed: queryIdToExecute,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: `Failed to trigger Dune query ${queryIdToExecute} (${queryName}).`,
          manual_execution_id: manualExecutionId,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error in POST handler"
    console.error(`[${manualExecutionId}] Manual Dune Query Trigger: CATCH BLOCK - Error: ${errorMsg}`, error)
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        message: "Manual Dune query trigger failed due to an unexpected error.",
        manual_execution_id: manualExecutionId,
      },
      { status: 500 },
    )
  }
}
