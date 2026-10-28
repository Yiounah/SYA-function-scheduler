"use strict";

// Same-origin desktop UI. Persistence and scheduling are owned by the service.
const COPY = {
  "zh": {
    "taskTree": "任务树",
    "treeHint": "横向查看阶段，展开子任务和清单；同级顺序可以调整并自动保存。",
    "expandAll": "全部展开",
    "collapseAll": "全部收起",
    "treeStage": "阶段 {number}",
    "treeTask": "子任务",
    "treeChecklist": "清单",
    "treeProgress": "{done}/{total} 项已完成",
    "treeTaskCount": "{count} 个子任务",
    "treeMinutes": "{minutes} 分钟",
    "moveLeft": "向左移动 {title}",
    "moveRight": "向右移动 {title}",
    "moveUp": "上移 {title}",
    "moveDown": "下移 {title}",
    "orderSaved": "顺序已保存",
    "orderFailed": "顺序未保存，请刷新后重试。",
    "emptyTree": "新建规划后，在这里查看阶段、子任务和清单。",
    "treeOrder": "同级排序",
    "treeSaveFailed": "展开状态尚未保存，下次展开或收起时会重试。",

    "brand": "任务规划",
    "newPlan": "新建规划",
    "nav": "导航",
    "day": "日",
    "timeline": "周",
    "calendar": "月",
    "myProjects": "我的课题",
    "newProject": "新建课题",
    "sidebarFooter": "本学期 · {count} 个进行中课题",
    "noProjects": "暂无课题",
    "searchPlaceholder": "搜索任务...",
    "searchAria": "搜索任务",
    "language": "语言",
    "noProjectYet": "还没有课题",
    "emptyMeta": "写下长程目标后生成研究时间轴",
    "span": "周期",
    "overall": "整体进度",
    "boardDay": "每日任务",
    "boardTimeline": "研究周报",
    "boardCalendar": "研究月历",
    "today": "今天",
    "emptyDay": "这一天没有安排。",
    "emptyWeek": "这一周没有落在日历上的阶段。",
    "prevPeriod": "上一页",
    "nextPeriod": "下一页",
    "legendDone": "已完成",
    "legendNow": "进行中",
    "legendTodo": "未开始",
    "week": "周",
    "month": "月",
    "subtasks": "子任务",
    "subtaskHeading": "{title} · 子任务",
    "subtaskCount": "共 {total} 项 · 已完成 {done} 项",
    "emptyBoard": "规划完成后，研究阶段会按时间出现在这里。",
    "noMatch": "没有匹配的任务",
    "emptySubtasks": "规划完成后，子任务会出现在这里。",
    "pickSubtask": "选择左侧子任务查看清单。",
    "noNotes": "暂无说明",
    "hours": "预计 {hours} 小时",
    "due": "截止 {date}",
    "addItem": "+ 添加清单项",
    "addItemTitle": "清单由规划引擎生成",
    "saveProgress": "保存进度",
    "modalIntro": "输入一个跨阶段的研究目标，生成时间轴和下一步清单。",
    "revisePlan": "修改规划",
    "reviseIntro": "修改当前的规划，重新拆分任务流，注意已经完成的任务项不参与拆分。",
    "resplit": "重新拆分",
    "longGoal": "长程目标",
    "goalPlaceholder": "例如：用最小 GPU 资源微调长程 LLM 智能体",
    "deadline": "完成期限",
    "dayUnit": "天",
    "needDeadline": "请填写完成期限。",
    "workSchedule": "作息安排",
    "scheduleHint": "午饭和晚饭不计入工时。先查看作息建议和受影响任务，再确认保存；失败会保留原作息。",
    "lunch": "午饭",
    "dinner": "晚饭",
    "lunchStart": "午饭开始",
    "lunchEnd": "午饭结束",
    "dinnerStart": "晚饭开始",
    "dinnerEnd": "晚饭结束",
    "periodStart": "工作开始",
    "periodEnd": "工作结束",
    "rangeOrder": "开始时间必须早于结束时间。",
    "hoursMismatch": "扣掉午饭和晚饭后，工作时段和每天工时不一致。",
    "entryTitle": "开始规划",
    "entryHint": "先确认可用时间与休息节奏。午饭、晚饭不计入可用时间。",
    "enterPlanner": "预览我的作息",
    "hoursPerDay": "每天可用时间（小时）",
    "periodPerDay": "可安排时段",
    "saveSchedule": "预览作息调整",
    "needSchedule": "请先修正标红的时间：开始必须早于结束，午饭和晚饭不计入工时。",
    "planningGrain": "规划粒度",
    "personaMacro": "远距里程碑",
    "personaBalanced": "均衡推进",
    "personaMicro": "近距拆细",
    "cancel": "取消",
    "generateTimeline": "生成时间轴",
    "needGoal": "请先写下长程目标。",
    "decomposingNow": "正在生成草案",
    "revising": "正在重新拆分未完成的部分…",
    "planFailed": "规划失败：{status}",
    "stepSaved": "已记录这一步",
    "progressSynced": "进度已同步",
    "focusTitle": "调整工作时段",
    "focusCopy": "你有 {count} 次在当前作息之外处理了任务。按这些实际工作时间，更合适的安排是每天 {hours} 小时，工作时段 {start}–{end}。",
    "focusNote": "任务内容不会改变，只会重排各阶段、子任务和清单的完成时间。",
    "focusApply": "预览建议",
    "focusKeep": "保持当前作息",
    "dayGrain": "任务粒度",
    "dayGrainHint": "为选定任务生成更细、标准或更粗的任务草案。检查并确认后才会调整，已完成和进行中的任务保留。",
    "dayGrainNote": "系统只提出建议，确认草案后才调整未开始的任务。",
    "grainFine": "更细",
    "grainSteady": "标准",
    "grainWide": "更粗",
    "grainFineDetail": "按目标时长拆分较长清单，请检查每段具体要做什么。",
    "grainSteadyDetail": "按目标时长拆分或合并未开始的同级清单。",
    "grainWideDetail": "合并适合连续处理的未开始清单。",
    "grainUseToday": "预览调整",
    "grainFineName": "更细",
    "grainSteadyName": "标准",
    "grainWideName": "更宽",
    "grainSuggestFineTitle": "把今天拆细",
    "grainSuggestWideTitle": "把今天的跨度放大",
    "grainSuggestOverdue": "今天有 {count} 项过了计划时间还未完成。可以预览约 25 分钟一段的安排，再检查每段的具体行动。",
    "grainSuggestOverrun": "有任务的记录时长超过了预计。可以预览约 25 分钟一段的安排，再检查每段的具体行动。",
    "grainSuggestFlow": "今天已完成 {count} 项，且没有逾期任务。可以预览合并相邻清单，安排约 90 分钟的连续工作。",
    "grainSuggestApply": "预览调整",
    "grainSuggestKeep": "保持今天的粒度",
    "weekdays": [
      "日",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六"
    ],
    "chooseAdjustment": "请选择要调整的任务",
    "missingMonitorTask": "提醒中的任务已不可用，请明确选择要调整的任务。",
    "activeAdjustment": "进行中任务保持不变，仅调整其未开始的同级清单",
    "restPreference": "补充偏好",
    "planSource": "规划方式",
    "useModel": "模型生成",
    "useSample": "示例演示（不调用模型）",
    "previewHint": "先检查草案，再确认加入正式计划。",
    "waitingHint": "生成期间正式计划保持不变，可以随时取消。",
    "retry": "重试",
    "regenerate": "重新生成",
    "discardDraft": "取消草案",
    "confirmDraft": "确认并保存",
    "draftTitle": "检查规划草案",
    "routineDraftTitle": "检查作息调整",
    "grainDraftTitle": "检查粒度调整",
    "draftIntro": "检查任务、时间安排及影响范围。确认后才会写入正式计划。",
    "generationFailed": "生成失败",
    "generationCancelled": "已取消，正式计划未改变",
    "draftConfirmed": "已确认，正式计划已保存",
    "savingDraft": "正在保存…",
    "sampleBadge": "示例计划 · 未使用模型生成",
    "preservedDone": "已完成和进行中的任务保持不变",
    "adjustedTasks": "受影响任务：{count} 项",
    "draftTasks": "清单：{count} 项",
    "draftSlots": "时间安排：{count} 段",
    "slotsTitle": "时间安排",
    "moreSlots": "另有 {count} 段时间安排",
    "emptySlots": "暂无时间安排",
    "draftLevels": [
      "课题",
      "阶段",
      "子任务",
      "清单"
    ],
    "adjustTarget": "调整范围",
    "allRemaining": "本课题尚未开始的任务",
    "noAdjustableTask": "请先建立课题并选择未完成任务。",
    "modelUnavailable": "模型暂不可用。请重试，或返回并明确选择示例演示。",
    "modelNotConfigured": "尚未配置模型密钥。请配置后重启应用，再重新生成。",
    "modelAuthFailed": "模型认证失败。请检查密钥是否有效，以及是否有该模型的使用权限。",
    "modelRateLimited": "模型请求受限。请检查可用额度，或稍后重试。",
    "modelTimeout": "模型响应超时。请稍后重试，你输入的目标仍保留。",
    "modelResponseInvalid": "模型未返回有效的规划。请重试，你输入的目标仍保留。",
    "staleDraft": "计划已发生变化，这份草案不能覆盖最新进度。请重新生成。",
    "draftExpired": "草案已失效，请重新生成。",
    "saveFailed": "保存未确认，请重试；重试不会重复创建计划。",
    "syncFailed": "未能读取最新计划，请检查连接后重试。",
    "configFailed": "作息同步失败，请重试；正式计划未被本次操作修改。",
    "pendingStatus": "未开始",
    "activeStatus": "进行中",
    "doneStatus": "已完成",
    "blockedStatus": "受阻",
    "skippedStatus": "已跳过",
    "statusFor": "{title} 的任务状态",
    "monitorReason": "调整建议：{reason}",
    "routineImpact": "工作时段 {start}–{end} · 每天 {hours} 小时",
    "restAdvice": "例如：下午更适合连续工作，休息时离开屏幕。",
    "workspaceTitle": "把目标，变成今天的一小步。",
    "workspaceSubtitle": "先安排可执行的任务，再按自己的节奏调整。",
    "workRestCycle": "专注与休息",
    "focusMinutes": "连续专注（分钟）",
    "breakMinutes": "短休息（分钟）",
    "recoveryMinutes": "长休息（分钟）",
    "cyclesBeforeRecovery": "每几轮安排长休息",
    "cycleHint": "休息会占用可用时间窗口，预览会展示任务是否顺延。",
    "mealSettings": "用餐时间（不计入可用时间）",
    "targetMinutes": "每个步骤的目标时长（分钟）",
    "targetRange": "{min}–{max} 分钟；{detail}",
    "selectedWork": "待调整 {count} 项 · 预计 {minutes} 分钟 · 保护 {preserved} 项已执行任务",
    "beforeLabel": "调整前",
    "afterLabel": "确认后",
    "checklistCount": "清单数量",
    "estimateMinutes": "预计工作量（分钟）",
    "protectedCount": "保留未改动",
    "targetStep": "单步目标",
    "minuteValue": "{minutes} 分钟",
    "noDraftChange": "当前任务已满足这个粒度，无需重复调整。可以返回修改范围或目标时长。",
    "changesTitle": "任务如何变化",
    "wholeTree": "查看完整任务树",
    "changeTo": "调整为",
    "totalSchedule": "专注和休息时间为全部排期汇总。",
    "durationAdjustment": "本次按时长分段或合并，请检查每步的具体行动；未使用模型重新理解任务内容。",
    "movedTasks": "排期变化的任务",
    "totalWorkMinutes": "全部专注时间",
    "totalBreakMinutes": "全部休息时间",
    "overflowTasks": "超出期限 {count} 项",
    "availableWindow": "每天可用窗口 {minutes} 分钟（已扣除用餐）",
    "cycleShort": "专注 {focus} 分钟 · 短休息 {rest} 分钟",
    "cycleLong": "每 {cycles} 轮 · 长休息 {rest} 分钟",
    "noCycle": "原排期未设置休息周期",
    "shortBreak": "短暂休息",
    "longBreak": "恢复休息",
    "breakCount": "当前日期范围安排 {count} 次休息，共 {minutes} 分钟。",
    "restSlotHint": "休息时间不计作任务，也不参与完成进度。",
    "affectedDetails": "查看受影响任务"
  },
  "en": {
    "taskTree": "Task tree",
    "treeHint": "Explore stages from left to right. Expand tasks and checklists; sibling order saves automatically.",
    "expandAll": "Expand all",
    "collapseAll": "Collapse all",
    "treeStage": "Stage {number}",
    "treeTask": "Task",
    "treeChecklist": "Checklist",
    "treeProgress": "{done}/{total} items completed",
    "treeTaskCount": "{count} tasks",
    "treeMinutes": "{minutes} min",
    "moveLeft": "Move {title} left",
    "moveRight": "Move {title} right",
    "moveUp": "Move {title} up",
    "moveDown": "Move {title} down",
    "orderSaved": "Order saved",
    "orderFailed": "Order was not saved. Refresh and retry.",
    "emptyTree": "Create a plan to see its stages, tasks and checklists here.",
    "treeOrder": "Reorder siblings",
    "treeSaveFailed": "Expansion preferences were not saved. The next expand or collapse will retry.",

    "brand": "Research Planner",
    "newPlan": "New plan",
    "nav": "Navigate",
    "day": "Day",
    "timeline": "Week",
    "calendar": "Month",
    "myProjects": "My projects",
    "newProject": "New project",
    "sidebarFooter": "This term · {count} active project(s)",
    "noProjects": "No projects yet",
    "searchPlaceholder": "Search tasks...",
    "searchAria": "Search tasks",
    "language": "Language",
    "noProjectYet": "No project yet",
    "emptyMeta": "Write a long-horizon goal to generate a research timeline",
    "span": "Span",
    "overall": "Overall",
    "boardDay": "Daily tasks",
    "boardTimeline": "Weekly report",
    "boardCalendar": "Research calendar",
    "today": "Today",
    "emptyDay": "Nothing is scheduled on this day.",
    "emptyWeek": "No stage falls on this week.",
    "prevPeriod": "Previous",
    "nextPeriod": "Next",
    "legendDone": "Done",
    "legendNow": "In progress",
    "legendTodo": "Not started",
    "week": "Week",
    "month": "Month",
    "subtasks": "Subtasks",
    "subtaskHeading": "{title} · Subtasks",
    "subtaskCount": "{total} items · {done} done",
    "emptyBoard": "After planning, research stages appear here on a timeline.",
    "noMatch": "No matching tasks",
    "emptySubtasks": "After planning, subtasks appear here.",
    "pickSubtask": "Select a subtask to see its checklist.",
    "noNotes": "No notes yet",
    "hours": "Est. {hours} h",
    "due": "Due {date}",
    "addItem": "+ Add item",
    "addItemTitle": "Checklist is generated by the planner",
    "saveProgress": "Save progress",
    "modalIntro": "Enter a multi-stage research goal to generate a timeline and next-step checklist.",
    "revisePlan": "Revise plan",
    "reviseIntro": "Revise this plan and resplit the task flow. Completed items stay as they are.",
    "resplit": "Resplit",
    "longGoal": "Long-horizon goal",
    "goalPlaceholder": "e.g. Fine-tune long-horizon LLM agents with minimal GPU",
    "deadline": "Deadline",
    "dayUnit": "Day",
    "needDeadline": "Enter a deadline.",
    "workSchedule": "Routine",
    "scheduleHint": "Meals are excluded from work time. Review the suggested routine and affected tasks before confirming. Failures preserve your current routine.",
    "lunch": "Lunch",
    "dinner": "Dinner",
    "lunchStart": "Lunch start",
    "lunchEnd": "Lunch end",
    "dinnerStart": "Dinner start",
    "dinnerEnd": "Dinner end",
    "periodStart": "Work start",
    "periodEnd": "Work end",
    "rangeOrder": "Start must be earlier than end.",
    "hoursMismatch": "After leaving out lunch and dinner, this period does not match the daily hours.",
    "entryTitle": "Start planning",
    "entryHint": "Confirm your availability and break rhythm. Lunch and dinner are excluded.",
    "enterPlanner": "Preview my routine",
    "hoursPerDay": "Available hours per day",
    "periodPerDay": "Available period",
    "saveSchedule": "Preview routine change",
    "needSchedule": "Fix the times in red: start must be earlier than end, and meals are not work time.",
    "planningGrain": "Planning grain",
    "personaMacro": "Distant milestones",
    "personaBalanced": "Balanced",
    "personaMicro": "Fine-grained",
    "cancel": "Cancel",
    "generateTimeline": "Generate timeline",
    "needGoal": "Write a long-horizon goal first.",
    "decomposingNow": "Generating a draft",
    "revising": "Resplitting unfinished work…",
    "planFailed": "Planning failed: {status}",
    "stepSaved": "Saved this step",
    "progressSynced": "Progress synced",
    "focusTitle": "Adjust work hours",
    "focusCopy": "You handled tasks outside the current routine {count} times. A better fit is {hours} hours a day, {start}–{end}.",
    "focusNote": "Task details stay the same. Only the completion times of stages, subtasks, and checklist items move.",
    "focusApply": "Preview suggestion",
    "focusKeep": "Keep current hours",
    "dayGrain": "Task granularity",
    "dayGrainHint": "Preview finer, standard or coarser steps for selected work. Confirm before applying; completed and active tasks are preserved.",
    "dayGrainNote": "This is a suggestion. Only confirmation changes not-yet-started tasks.",
    "grainFine": "Finer",
    "grainSteady": "Standard",
    "grainWide": "Coarser",
    "grainFineDetail": "Split longer items by target duration; review what to do in each segment.",
    "grainSteadyDetail": "Split or combine unstarted sibling items to fit the target duration.",
    "grainWideDetail": "Combine suitable unstarted steps into a continuous block.",
    "grainUseToday": "Preview adjustment",
    "grainFineName": "Finer",
    "grainSteadyName": "Standard",
    "grainWideName": "Wider",
    "grainSuggestFineTitle": "Split today more finely",
    "grainSuggestWideTitle": "Widen today's span",
    "grainSuggestOverdue": "{count} items today are still open after their planned time. Split today into about 25-minute steps you can start right away.",
    "grainSuggestOverrun": "A task’s recorded time exceeds its estimate. Preview roughly 25-minute segments and review each next action.",
    "grainSuggestFlow": "You finished {count} items today with nothing overdue. Preview combining adjacent items into roughly 90-minute work periods.",
    "grainSuggestApply": "Preview adjustment",
    "grainSuggestKeep": "Keep today's grain",
    "weekdays": [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ],
    "chooseAdjustment": "Choose work to adjust",
    "missingMonitorTask": "The suggested task is unavailable. Choose the work you want to adjust.",
    "activeAdjustment": "Keep this active task; adjust only its unstarted sibling items",
    "restPreference": "Additional preferences",
    "planSource": "Planning mode",
    "useModel": "Generate with model",
    "useSample": "Sample demo (no model call)",
    "previewHint": "Review a draft before adding it to your saved plan.",
    "waitingHint": "Your saved plan stays unchanged while generating. You can cancel at any time.",
    "retry": "Retry",
    "regenerate": "Generate again",
    "discardDraft": "Discard draft",
    "confirmDraft": "Confirm and save",
    "draftTitle": "Review plan draft",
    "routineDraftTitle": "Review routine change",
    "grainDraftTitle": "Review granularity change",
    "draftIntro": "Review tasks, scheduled times and affected work. Changes are saved only after confirmation.",
    "generationFailed": "Generation failed",
    "generationCancelled": "Cancelled. Your saved plan is unchanged.",
    "draftConfirmed": "Confirmed and saved",
    "savingDraft": "Saving…",
    "sampleBadge": "Sample plan · not model generated",
    "preservedDone": "Completed and active tasks stay unchanged",
    "adjustedTasks": "Affected tasks: {count}",
    "draftTasks": "Checklist items: {count}",
    "draftSlots": "Time slots: {count}",
    "slotsTitle": "Scheduled times",
    "moreSlots": "{count} more time slots",
    "emptySlots": "No scheduled times yet",
    "draftLevels": [
      "Project",
      "Stage",
      "Task",
      "Checklist"
    ],
    "adjustTarget": "Work to adjust",
    "allRemaining": "Not-yet-started work in this project",
    "noAdjustableTask": "Create a project and choose unfinished work first.",
    "modelUnavailable": "The model is unavailable. Retry, or return and explicitly choose the sample demo.",
    "modelNotConfigured": "No model API key is configured. Add a key, restart the app, then generate again.",
    "modelAuthFailed": "Model authentication failed. Check that the key is valid and has access to this model.",
    "modelRateLimited": "Model requests are limited. Check your available quota or retry later.",
    "modelTimeout": "The model timed out. Retry later; your goal has been kept.",
    "modelResponseInvalid": "The model did not return a valid plan. Retry; your goal has been kept.",
    "staleDraft": "Your plan changed. This draft cannot overwrite the latest progress. Generate a new draft.",
    "draftExpired": "This draft expired. Generate a new draft.",
    "saveFailed": "Save is not confirmed. Retry safely without creating a duplicate plan.",
    "syncFailed": "Could not read the latest plan. Check the connection and retry.",
    "configFailed": "Routine synchronization failed. Retry; this action has not changed the saved plan.",
    "pendingStatus": "Pending",
    "activeStatus": "In progress",
    "doneStatus": "Done",
    "blockedStatus": "Blocked",
    "skippedStatus": "Skipped",
    "statusFor": "Task status for {title}",
    "monitorReason": "Adjustment suggestion: {reason}",
    "routineImpact": "Work {start}–{end} · {hours} hours/day",
    "restAdvice": "For example: longer sessions in the afternoon; leave the screen during breaks.",
    "workspaceTitle": "Turn a goal into today’s next step.",
    "workspaceSubtitle": "Make the work actionable, then adjust it to your rhythm.",
    "workRestCycle": "Focus and breaks",
    "focusMinutes": "Continuous focus (minutes)",
    "breakMinutes": "Short break (minutes)",
    "recoveryMinutes": "Long break (minutes)",
    "cyclesBeforeRecovery": "Cycles before a long break",
    "cycleHint": "Breaks use available time. Preview shows whether work moves to later times.",
    "mealSettings": "Meal periods (excluded from availability)",
    "targetMinutes": "Target length per step (minutes)",
    "targetRange": "{min}–{max} minutes; {detail}",
    "selectedWork": "{count} items · {minutes} estimated minutes · {preserved} executed items protected",
    "beforeLabel": "Before",
    "afterLabel": "After confirmation",
    "checklistCount": "Checklist items",
    "estimateMinutes": "Estimated work (minutes)",
    "protectedCount": "Unchanged items kept",
    "targetStep": "Target per step",
    "minuteValue": "{minutes} min",
    "noDraftChange": "The work already matches this grain. Return to change the target or scope.",
    "changesTitle": "How tasks change",
    "wholeTree": "View complete task tree",
    "changeTo": "Becomes",
    "totalSchedule": "Focus and break totals cover the whole schedule.",
    "durationAdjustment": "This adjustment splits or combines work by duration. Review each next action; no model reinterpreted the task content.",
    "movedTasks": "Tasks rescheduled",
    "totalWorkMinutes": "Total focus time",
    "totalBreakMinutes": "Total break time",
    "overflowTasks": "{count} tasks beyond deadline",
    "availableWindow": "Daily available window: {minutes} minutes, excluding meals",
    "cycleShort": "Focus {focus} min · break {rest} min",
    "cycleLong": "Every {cycles} cycles · long break {rest} min",
    "noCycle": "No break cycle in the previous routine",
    "shortBreak": "Short break",
    "longBreak": "Recovery break",
    "breakCount": "{count} breaks in this date range, totaling {minutes} minutes.",
    "restSlotHint": "Breaks are not tasks and do not count toward task progress.",
    "affectedDetails": "View affected tasks"
  }
};

const PROJECT_COLORS = ["#5aa779", "#0f766e", "#d97706", "#7c3aed", "#e11d48", "#16a34a", "#0891b2", "#c026d3"];

const GRAIN_OPTIONS = { fine: { min: 5, max: 30, value: 25 }, steady: { min: 25, max: 60, value: 45 }, wide: { min: 45, max: 120, value: 90 } };
const CYCLE_FIELDS = { focusMinutes: ["focus-minutes", 45], breakMinutes: ["break-minutes", 5], recoveryMinutes: ["recovery-minutes", 15], cyclesBeforeRecovery: ["cycles", 4] };

const state = {
  projects: [],
  selectedProjectId: null,
  tree: null,
  ws: null,
  inflight: false,
  nav: "tree",
  treeDisclosure: loadTreeDisclosure(),
  treeDisclosureDirty: false,
  treeDisclosureSaving: false,
  treeDisclosurePromise: null,
  searchDisclosure: {},
  reordering: false,
  boardFocusId: null,
  focus: null,
  selectedMilestoneId: null,
  selectedSubtaskId: null,
  search: "",
  horizonDays: null,
  deadlineAmount: null,
  deadlineUnit: "week",
  formMode: "new",
  reviseTaskId: null,
  hoursPerDay: 6,
  periodStart: 10 * 60,
  periodEnd: 18 * 60,
  lunchStart: 12 * 60,
  lunchEnd: 14 * 60,
  dinnerStart: 18 * 60,
  dinnerEnd: 20 * 60,
  persona: "balanced",
  locale: window.localStorage.getItem("focusflow.locale") === "en" ? "en" : "zh",
  copyCache: {},
  copyToken: 0,
  slots: [],
  breaks: [],
  cycle: Object.fromEntries(Object.entries(CYCLE_FIELDS).map(([key, [, value]]) => [key, value])),
  loadToken: 0,
  generationToken: 0,
  generationController: null,
  draft: null,
  previewRequest: null,
  committing: false,
  monitor: null,
  pendingStatus: new Set(),
};

const toast = document.getElementById("toast");
const modal = document.getElementById("modal");
const initForm = document.getElementById("init-form");
const initButton = document.getElementById("init-button");

function t(key, vars) {
  const table = COPY[state.locale] || COPY.zh;
  let text = table[key];
  if (text == null) text = COPY.zh[key];
  if (text == null) return key;
  if (Array.isArray(text)) return text;
  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      text = String(text).replaceAll(`{${name}}`, String(value));
    });
  }
  return text;
}

function applyStaticCopy() {
  document.documentElement.lang = state.locale === "en" ? "en" : "zh-CN";
  document.title = t("brand");
  document.getElementById("lang-toggle").setAttribute("aria-label", t("language"));
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === state.locale);
  });
}

function setLocale(locale) {
  state.locale = locale === "en" ? "en" : "zh";
  window.localStorage.setItem("focusflow.locale", state.locale);
  applyStaticCopy();
  refreshScheduleForms(false);
  renderAll();
  if (document.getElementById("focus-modal").classList.contains("open")) maybePromptFocus();
  if (document.getElementById("grain-modal").classList.contains("open")) paintGrainChoices(state.pendingGrain || currentDayGrain(), false);
  ensureLocaleCopy();
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function walkNodes(node, bucket = []) {
  if (!node) return bucket;
  bucket.push(node);
  (node.children || []).forEach((child) => walkNodes(child, bucket));
  return bucket;
}

function copyKey(locale, node) {
  return `${locale}\0${node.task_id}\0${node.title}`;
}

function taskTitle(node) {
  if (!node) return "";
  return state.copyCache[copyKey(state.locale, node)]?.title || node.title;
}

function taskDescription(node) {
  if (!node) return "";
  const cached = state.copyCache[copyKey(state.locale, node)];
  if (cached) return cached.description || "";
  return node.description || "";
}

function treeNeedsTranslation(tree, locale) {
  const nodes = walkNodes(tree);
  if (locale === "zh") return nodes.some((node) => node.title && !hasCjk(node.title));
  return nodes.some((node) => node.title && hasCjk(node.title));
}

async function ensureLocaleCopy() {
  const locale = state.locale;
  const trees = state.projects.map((project) => project.tree).filter(Boolean);
  if (!trees.some((tree) => treeNeedsTranslation(tree, locale))) return;
  const pending = trees.flatMap((tree) => walkNodes(tree))
    .filter((node) => node.title && !state.copyCache[copyKey(locale, node)]);
  if (!pending.length) return;
  const token = state.copyToken + 1;
  state.copyToken = token;
  try {
    for (let offset = 0; offset < pending.length; offset += 200) {
      const batch = pending.slice(offset, offset + 200);
      const response = await fetch("/api/v1/tasks/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: locale,
          nodes: batch.map((node) => ({
            task_id: node.task_id,
            title: node.title,
            description: node.description || "",
          })),
        }),
      });
      if (!response.ok || token !== state.copyToken || state.locale !== locale) return;
      const payload = await response.json();
      (payload.nodes || []).forEach((node) => {
        const source = batch.find((item) => item.task_id === node.task_id);
        if (!source || !node.title) return;
        state.copyCache[copyKey(locale, source)] = {
          title: node.title,
          description: node.description || "",
        };
      });
    }
    if (state.locale === locale) renderAll();
  } catch {
    // Keep the stored wording when translation is unavailable.
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function setBusy(isBusy) {
  state.inflight = isBusy;
  initButton.disabled = isBusy;
}

function setDecomposing(active) {
  const overlay = document.getElementById("decompose-overlay");
  document.getElementById("decompose-label").textContent = t("decomposingNow");
  overlay.classList.toggle("open", active);
  overlay.setAttribute("aria-hidden", active ? "false" : "true");
}

function formatDate(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function collectLeaves(node) {
  if (!node) return [];
  if (!node.children || node.children.length === 0) return [node];
  return node.children.flatMap(collectLeaves);
}

function nodeKind(node) {
  if (!node) return "todo";
  if (node.status === "DONE") return "done";
  if (node.status === "IN_PROGRESS" || collectLeaves(node).some((leaf) => leaf.status === "IN_PROGRESS")) return "current";
  if (collectLeaves(node).every((leaf) => leaf.status === "DONE")) return "done";
  return "todo";
}

function milestones() {
  if (!state.tree) return [];
  return state.tree.children && state.tree.children.length ? state.tree.children : [state.tree];
}

function storedNumber(key) {
  const raw = window.localStorage.getItem(key);
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function loadSchedule() {
  const hours = storedNumber("focusflow.hoursPerDay");
  const start = storedNumber("focusflow.periodStart");
  const end = storedNumber("focusflow.periodEnd");
  const lunchStart = storedNumber("focusflow.lunchStart");
  const lunchEnd = storedNumber("focusflow.lunchEnd");
  const dinnerStart = storedNumber("focusflow.dinnerStart");
  const dinnerEnd = storedNumber("focusflow.dinnerEnd");
  const persona = window.localStorage.getItem("focusflow.persona");
  if (hours != null && hours >= 0.5 && hours <= 16) state.hoursPerDay = hours;
  if (start != null && Number.isInteger(start) && start >= 0 && start < 24 * 60) state.periodStart = start;
  if (end != null && Number.isInteger(end) && end > state.periodStart && end <= 24 * 60) state.periodEnd = end;
  if (lunchStart != null && lunchEnd != null && lunchEnd > lunchStart) {
    state.lunchStart = lunchStart;
    state.lunchEnd = lunchEnd;
  }
  if (dinnerStart != null && dinnerEnd != null && dinnerEnd > dinnerStart) {
    state.dinnerStart = dinnerStart;
    state.dinnerEnd = dinnerEnd;
  }
  if (persona === "macro" || persona === "balanced" || persona === "micro") state.persona = persona;
}

function sharedDeskBody() {
  let dayGrain = {};
  try {
    dayGrain = JSON.parse(window.localStorage.getItem("focusflow.dayGrain") || "{}");
  } catch {
    dayGrain = {};
  }
  const today = ymd(startOfDay(new Date()));
  return {
    workStart: clock(state.periodStart),
    workEnd: clock(state.periodEnd),
    ...state.cycle,
    todayGrain: { date: today, level: currentDayGrain() },
    focusflow: {
      hoursPerDay: state.hoursPerDay,
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      lunchStart: state.lunchStart,
      lunchEnd: state.lunchEnd,
      dinnerStart: state.dinnerStart,
      dinnerEnd: state.dinnerEnd,
      persona: state.persona,
      dayGrain,
      dayGrainDismissed: window.localStorage.getItem("focusflow.dayGrainDismissed"),
      focusDismissed: window.localStorage.getItem("focusflow.focusDismissed"),
      workLog: readWorkLog(),
    },
  };
}

async function pushSharedDesk() {
  try {
    const metadata = sharedDeskBody().focusflow;
    await requestJson("/api/scheduler/config", { method: "PUT", body: JSON.stringify({ focusflow: {
      dayGrain: metadata.dayGrain, dayGrainDismissed: metadata.dayGrainDismissed,
      focusDismissed: metadata.focusDismissed, workLog: metadata.workLog,
    } }) });
    return true;
  } catch (error) {
    showSyncError(error.message || t("configFailed"));
    return false;
  }
}

function applySharedValue(key, value) {
  if (value == null || value === "") window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, String(value));
}

async function pullSharedDesk() {
  try {
    const config = await requestJson("/api/scheduler/config");
    const desk = config.focusflow && typeof config.focusflow === "object" ? config.focusflow : {};
    if (!state.treeDisclosureDirty && !state.treeDisclosureSaving && desk.treeDisclosure && typeof desk.treeDisclosure === "object" && !Array.isArray(desk.treeDisclosure)) {
      state.treeDisclosure = desk.treeDisclosure;
      cacheTreeDisclosure();
    }
    state.rest = config.rest || "";
    state.appliedGrainTarget = config.todayGrain?.date === ymd(startOfDay(new Date())) ? config.todayGrain.targetMinutes : null;
    for (const [key, [, fallback]] of Object.entries(CYCLE_FIELDS)) state.cycle[key] = Number.isFinite(config[key]) ? config[key] : fallback;
    const start = minutesFromClock(config.workStart) ?? desk.periodStart;
    const end = minutesFromClock(config.workEnd) ?? desk.periodEnd;
    const meals = mealRanges([{ start: desk.lunchStart ?? state.lunchStart, end: desk.lunchEnd ?? state.lunchEnd }, { start: desk.dinnerStart ?? state.dinnerStart, end: desk.dinnerEnd ?? state.dinnerEnd }]);
    const hours = start != null && end != null ? workableMinutes(start, end, meals) / 60 : desk.hoursPerDay;
    state.hasSharedRoutine = Number.isFinite(desk.hoursPerDay) && Number.isFinite(hours) && hours > 0;
    applySharedValue("focusflow.hoursPerDay", hours);
    applySharedValue("focusflow.periodStart", start);
    applySharedValue("focusflow.periodEnd", end);
    applySharedValue("focusflow.lunchStart", desk.lunchStart);
    applySharedValue("focusflow.lunchEnd", desk.lunchEnd);
    applySharedValue("focusflow.dinnerStart", desk.dinnerStart);
    applySharedValue("focusflow.dinnerEnd", desk.dinnerEnd);
    applySharedValue("focusflow.persona", desk.persona);
    applySharedValue("focusflow.dayGrainDismissed", desk.dayGrainDismissed);
    applySharedValue("focusflow.focusDismissed", desk.focusDismissed);
    if (desk.dayGrain && typeof desk.dayGrain === "object") {
      window.localStorage.setItem("focusflow.dayGrain", JSON.stringify(desk.dayGrain));
    }
    if (Array.isArray(desk.workLog)) {
      window.localStorage.setItem("focusflow.workLog", JSON.stringify(desk.workLog));
    }
    loadSchedule();
  } catch (error) {
    showSyncError(error.message || t("syncFailed"));
  }
}

function mealRanges(meals) {
  const source = meals || [
    { start: state.lunchStart, end: state.lunchEnd },
    { start: state.dinnerStart, end: state.dinnerEnd },
  ];
  const merged = [];
  source
    .filter((meal) => meal.end > meal.start)
    .sort((left, right) => left.start - right.start)
    .forEach((meal) => {
      const last = merged[merged.length - 1];
      if (last && meal.start <= last.end) last.end = Math.max(last.end, meal.end);
      else merged.push({ start: meal.start, end: meal.end });
    });
  return merged;
}

function workableMinutes(start, end, meals = mealRanges()) {
  if (!(end > start)) return 0;
  let total = end - start;
  meals.forEach((meal) => {
    const from = Math.max(start, meal.start);
    const to = Math.min(end, meal.end);
    if (to > from) total -= to - from;
  });
  return Math.max(0, total);
}

function endAfterWork(start, minutes, meals = mealRanges()) {
  if (start == null || !(minutes > 0)) return null;
  let cursor = start;
  let left = minutes;
  const limit = 24 * 60;
  while (left > 0) {
    if (cursor >= limit) return null;
    const meal = meals.find((item) => cursor >= item.start && cursor < item.end);
    if (meal) {
      cursor = meal.end;
      continue;
    }
    const nextMeal = meals.find((item) => item.start > cursor);
    const blockEnd = Math.min(limit, nextMeal ? nextMeal.start : limit);
    if (blockEnd <= cursor) return null;
    const take = Math.min(left, blockEnd - cursor);
    cursor += take;
    left -= take;
  }
  return cursor < limit ? cursor : null;
}

function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(date, count) {
  const day = new Date(date);
  day.setDate(day.getDate() + count);
  return day;
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseYmd(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayOf(date) {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

function clock(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function localeTag() {
  return state.locale === "en" ? "en-US" : "zh-CN";
}

function weekdayLabels() {
  const names = t("weekdays");
  return [...names.slice(1), names[0]];
}

function collectWork(root) {
  const items = [];
  if (!root) return items;
  function visit(node, stage, subtask) {
    if (!node.children || node.children.length === 0) {
      items.push({ node, stage: stage || node, subtask: subtask || node });
      return;
    }
    node.children.forEach((child) => {
      visit(child, stage || child, stage ? (subtask || child) : null);
    });
  }
  visit(root, null, null);
  return items;
}

function spanDays(amount, unit) {
  const count = Math.floor(Number(amount));
  if (!Number.isInteger(count) || count < 1) return null;
  if (unit === "week") return count * 7;
  if (unit === "month") {
    const start = startOfDay(new Date());
    const end = new Date(start.getFullYear(), start.getMonth() + count, start.getDate());
    return Math.max(1, Math.round((startOfDay(end) - start) / 86400000) + 1);
  }
  return count;
}

function slotLabel(from, to) {
  if (to <= 24 * 60 && from < 24 * 60) return `${clock(from)}–${clock(to)}`;
  const hours = (to - from) / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
}

function scheduleProjects(projects) {
  return (projects || []).filter((project) => project && project.tree).flatMap((project) =>
    collectWork(project.tree).map((item) => {
      const slots = state.slots.filter((slot) => slot.taskId === item.node.task_id).map((slot) => ({
        date: parseYmd(slot.date || String(slot.startTime).slice(0, 10)),
        from: minutesFromClock(slot.start || String(slot.startTime).slice(11, 16)),
        to: minutesFromClock(slot.end || String(slot.endTime).slice(11, 16)),
      })).filter((slot) => Number.isFinite(slot.date.getTime()) && slot.from != null && slot.to > slot.from)
        .sort((a, b) => a.date - b.date || a.from - b.from);
      if (!slots.length) return null;
      return { ...item, projectId: project.tree.task_id, projectTitle: project.tree.title, color: project.color,
        slots, start: slots[0].date, end: slots[slots.length - 1].date };
    }).filter(Boolean)
  );
}

function stagesInOrder(plan) {
  const seen = new Set();
  const stages = [];
  plan.forEach((item) => {
    if (seen.has(item.stage.task_id)) return;
    seen.add(item.stage.task_id);
    stages.push(item.stage);
  });
  return stages;
}

function stageSpan(plan, stageId) {
  const items = plan.filter((item) => item.stage.task_id === stageId);
  if (!items.length) return null;
  return {
    start: items.reduce((min, item) => (item.start < min ? item.start : min), items[0].start),
    end: items.reduce((max, item) => (item.end > max ? item.end : max), items[0].end),
  };
}

function subtasksOf(milestone) {
  if (!milestone) return [];
  return milestone.children && milestone.children.length ? milestone.children : [milestone];
}

function selectedMilestone() {
  const items = milestones();
  return items.find((node) => node.task_id === state.selectedMilestoneId) || items[0] || null;
}

function matchesSearch(node) {
  const query = state.search.trim().toLowerCase();
  if (!query) return true;
  return `${node.title} ${node.description || ""} ${taskTitle(node)} ${taskDescription(node)}`.toLowerCase().includes(query);
}

function ensureSelection() {
  const items = milestones();
  if (!items.length) {
    state.selectedMilestoneId = null;
    state.selectedSubtaskId = null;
    return;
  }
  if (!items.some((node) => node.task_id === state.selectedMilestoneId)) {
    const current = items.find((node) => nodeKind(node) === "current") || items.find((node) => nodeKind(node) !== "done") || items[0];
    state.selectedMilestoneId = current.task_id;
  }
  const tasks = subtasksOf(selectedMilestone()).filter(matchesSearch);
  if (!tasks.some((node) => node.task_id === state.selectedSubtaskId)) {
    state.selectedSubtaskId = tasks[0]?.task_id || null;
  }
}

const PROJECT_TAGS = [
  { zh: "生活", en: "Life", keys: ["habit", "rising", "routine", "lifestyle", "household", "chore", "sleep", "wake", "习惯", "早起", "生活", "作息", "家务", "日常", "睡眠"] },
  { zh: "学术", en: "Academic", keys: ["ielts", "toefl", "gre", "gmat", "exam", "quiz", "course", "lecture", "homework", "semester", "雅思", "托福", "考试", "备考", "课程", "作业", "学业", "学分"] },
  { zh: "研究课题", en: "Research", keys: ["research", "experiment", "thesis", "dissertation", "laboratory", "fine-tun", "finetun", "agent", "gpu", "llm", "研究", "课题", "实验", "微调", "智能体", "论文"] },
  { zh: "工作", en: "Work", keys: ["meeting", "stakeholder", "client", "invoice", "工作", "会议", "客户", "职场", "交付"] },
  { zh: "健康", en: "Health", keys: ["fitness", "workout", "nutrition", "medical", "clinic", "健康", "健身", "减肥", "饮食", "医疗", "跑步"] },
  { zh: "创作", en: "Creative", keys: ["novel", "compose", "illustration", "小说", "作曲", "绘画", "创作", "设计"] },
  { zh: "财务", en: "Finance", keys: ["budget", "invest", "理财", "预算", "报销", "记账"] },
];

function projectTag(project) {
  const fallback = state.locale === "en" ? "General" : "综合";
  if (!project || !project.tree) return fallback;
  const parts = [];
  if (project.goal) parts.push(project.goal);
  walkNodes(project.tree).forEach((node) => {
    parts.push(node.title || "", node.description || "", taskTitle(node), taskDescription(node));
  });
  const text = parts.join("\n").toLowerCase();
  let best = null;
  let bestHits = 0;
  let bestWeight = 0;
  PROJECT_TAGS.forEach((tag) => {
    let hits = 0;
    let weight = 0;
    tag.keys.forEach((key) => {
      if (!text.includes(key.toLowerCase())) return;
      hits += 1;
      weight += key.length;
    });
    if (hits > bestHits || (hits === bestHits && weight > bestWeight)) {
      best = tag;
      bestHits = hits;
      bestWeight = weight;
    }
  });
  if (!best || bestHits === 0) return fallback;
  return state.locale === "en" ? best.en : best.zh;
}

function renderSidebar() {
  const count = state.projects.length;
  document.getElementById("sidebar-footer").textContent = t("sidebarFooter", { count });
  document.getElementById("project-list").innerHTML = count
    ? state.projects.map((project) => {
        const active = project.tree.task_id === state.selectedProjectId;
        const title = taskTitle(project.tree);
        return `<button class="project-item${active ? " active" : ""}" type="button" data-project-id="${escapeHtml(project.tree.task_id)}" title="${escapeHtml(title)}" style="--frame:${project.color}"><i class="project-swatch" aria-hidden="true"></i><span>${escapeHtml(title)}</span></button>`;
      }).join("")
    : `<div class="empty" style="padding: 8px 12px">${escapeHtml(t("noProjects"))}</div>`;
}

function renderHeader() {
  const leaves = collectLeaves(state.tree);
  const done = leaves.filter((leaf) => leaf.status === "DONE").length;
  const ratio = leaves.length ? done / leaves.length : 0;
  const plan = (state.plan || []).filter((item) => item.projectId === state.selectedProjectId);
  const from = plan[0]?.start;
  const to = plan.length ? plan.reduce((max, item) => (item.end > max ? item.end : max), plan[0].end) : null;
  const project = state.projects.find((item) => item.tree.task_id === state.selectedProjectId);
  const origin = project?.started_at ? startOfDay(new Date(project.started_at)) : from;
  const deadline = state.horizonDays && origin ? addDays(origin, state.horizonDays - 1) : null;
  const color = state.projects.find((project) => project.tree.task_id === state.selectedProjectId)?.color || "";
  const revise = document.getElementById("revise-current");
  revise.hidden = !state.tree;
  revise.textContent = t("revisePlan");
  const tag = projectTag(state.projects.find((project) => project.tree.task_id === state.selectedProjectId));
  document.querySelector(".project-head").style.setProperty("--frame", color || "transparent");
  document.getElementById("project-title").textContent = state.tree ? taskTitle(state.tree) : t("noProjectYet");
  document.getElementById("project-meta").innerHTML = state.tree && from && to
    ? `<span class="chip">${escapeHtml(tag)}</span><span>${escapeHtml(t("span"))} ${formatDate(from)} - ${formatDate(to)}</span>${deadline ? `<span>${escapeHtml(t("deadline"))} ${formatDate(deadline)}</span>` : ""}<span>${escapeHtml(t("overall"))} ${Math.round(ratio * 100)}%</span>`
    : escapeHtml(state.tree ? tag : t("emptyMeta"));
  document.getElementById("progress-bar").style.width = `${Math.round(ratio * 100)}%`;
  document.getElementById("progress-label").textContent = `${Math.round(ratio * 100)}%`;
}

function dayItemHtml(item, from, to, label) {
  const done = item.node.status === "DONE";
  return `
    <div class="day-item${done ? " done" : ""}" style="--frame:${item.color}">
      <time>${slotLabel(from, to)}</time>
      <button type="button" data-project-id="${escapeHtml(item.projectId)}" data-milestone-id="${escapeHtml(item.stage.task_id)}" data-subtask-id="${escapeHtml(item.subtask.task_id)}">
        <strong>${escapeHtml(label)} <em class="status-tag ${nodeKind(item.node)}">${escapeHtml(t(item.node.status === "DONE" ? "doneStatus" : item.node.status === "IN_PROGRESS" ? "activeStatus" : item.node.status === "BLOCKED" ? "blockedStatus" : item.node.status === "SKIPPED" ? "skippedStatus" : "pendingStatus"))}</em></strong>
        <span>${escapeHtml(taskTitle(item.stage))} · ${escapeHtml(taskTitle({ task_id: item.projectId, title: item.projectTitle }))}</span>
      </button>
      <input type="checkbox" aria-label="${escapeHtml(label)}" data-task-id="${escapeHtml(item.node.task_id)}" ${done ? "checked" : ""} ${state.pendingStatus.has(item.node.task_id) ? "disabled" : ""} />
    </div>`;
}

function renderDay(plan) {
  const rows = plan.flatMap((item) => item.slots.filter((slot) => sameDay(slot.date, state.focus))
    .filter(() => matchesSearch(item.node) || matchesSearch(item.stage) || matchesSearch(item.subtask))
    .map((slot) => ({ item, slot })));
  rows.sort((left, right) => left.slot.from - right.slot.from);
  const board = document.getElementById("board");
  board.className = "day-agenda";
  const display = [];
  rows.forEach(({ item, slot }) => {
    const last = display[display.length - 1];
    if (last && last.item.node.task_id === item.node.task_id && last.slot.to === slot.from) last.slot.to = slot.to;
    else display.push({ item, slot: { ...slot } });
  });
  const agenda = display.map(({ item, slot }) => ({ from: slot.from, html: dayItemHtml(item, slot.from, slot.to, taskTitle(item.node)) }));
  state.breaks.filter((slot) => slot.date === ymd(state.focus)).forEach((slot) => {
    agenda.push({ from: minutesFromClock(slot.start), html: `<div class="break-item"><time>${escapeHtml(slot.start)}–${escapeHtml(slot.end)}</time><span>${escapeHtml(t(slot.kind === "recovery" ? "longBreak" : "shortBreak"))}</span><span class="status-tag">${minutesFromClock(slot.end) - minutesFromClock(slot.start)} min</span></div>` });
  });
  board.innerHTML = agenda.sort((a, b) => a.from - b.from).map((row) => row.html).join("")
    || `<div class="empty">${escapeHtml(state.projects.length ? t("emptyDay") : t("emptyBoard"))}</div>`;
}

function renderTimeline(plan) {
  const board = document.getElementById("board");
  const weekStart = mondayOf(state.focus);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = days[6];
  const rows = stagesInOrder(plan).map((stage) => ({ stage, span: stageSpan(plan, stage.task_id) }))
    .filter(({ stage, span }) => span && span.end >= weekStart && span.start <= weekEnd
      && plan.some((item) => item.stage.task_id === stage.task_id
        && (matchesSearch(item.node) || matchesSearch(item.stage) || matchesSearch(item.subtask))));
  const head = days.map((date) => `<span class="${sameDay(date, startOfDay(new Date())) ? "today" : ""}">${escapeHtml(weekdayLabels()[(date.getDay() + 6) % 7])} ${date.getDate()}</span>`).join("");
  board.className = "week-board";
  board.innerHTML = `
    <div class="week-head"><span></span><div class="week-days">${head}</div></div>
    ${rows.length ? rows.map(({ stage, span }) => {
      const from = span.start < weekStart ? weekStart : span.start;
      const to = span.end > weekEnd ? weekEnd : span.end;
      const startCol = Math.round((startOfDay(from) - weekStart) / 86400000);
      const endCol = Math.round((startOfDay(to) - weekStart) / 86400000);
      const kind = nodeKind(stage);
      const owner = plan.find((item) => item.stage.task_id === stage.task_id);
      const color = owner?.color || "#3b82f6";
      const range = sameDay(span.start, span.end) ? shortDate(span.start) : `${shortDate(span.start)}–${shortDate(span.end)}`;
      const fullRange = `${taskTitle(stage)} · ${formatDate(span.start)}–${formatDate(span.end)}`;
      const cells = days.map((date) => `<i class="${sameDay(date, startOfDay(new Date())) ? "today" : ""}"></i>`).join("");
    return `
        <div class="week-row" style="--frame:${color}">
          <button class="stage-name ${kind}" type="button" data-project-id="${escapeHtml(owner?.projectId || "")}" data-milestone-id="${escapeHtml(stage.task_id)}">${escapeHtml(taskTitle(stage))}</button>
          <div class="week-track">
            ${cells}
            <button class="bar ${kind}" type="button" title="${escapeHtml(fullRange)}" aria-label="${escapeHtml(fullRange)}" data-project-id="${escapeHtml(owner?.projectId || "")}" data-milestone-id="${escapeHtml(stage.task_id)}" style="--frame:${color};left:${(startCol / 7) * 100}%;width:${((endCol - startCol + 1) / 7) * 100}%">${escapeHtml(range)}</button>
          </div>
        </div>
      `;
    }).join("") : `<div class="empty">${escapeHtml(state.projects.length ? t("emptyWeek") : t("emptyBoard"))}</div>`}
  `;
}

function renderMonth(plan) {
  const board = document.getElementById("board");
  const year = state.focus.getFullYear();
  const month = state.focus.getMonth();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());
  const cells = [];
  for (let index = 0; index < startPad; index += 1) cells.push(`<div class="day empty"></div>`);
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const marks = [];
    plan.forEach((item) => {
      if (!matchesSearch(item.node) && !matchesSearch(item.stage) && !matchesSearch(item.subtask)) return;
      if (!item.slots.some((slot) => sameDay(slot.date, date))) return;
      if (marks.some((mark) => mark.id === item.node.task_id)) return;
      marks.push({ id: item.node.task_id, title: taskTitle(item.node), color: item.color, projectId: item.projectId, stageId: item.stage.task_id });
    });
    const preview = marks.slice(0, 2).map((mark) => `<small class="month-chip" data-project-id="${escapeHtml(mark.projectId)}" data-milestone-id="${escapeHtml(mark.stageId)}" style="--frame:${mark.color}">${escapeHtml(mark.title)}</small>`).join("");
    const extra = marks.length > 2 ? `<small>+${marks.length - 2}</small>` : "";
    cells.push(`<button class="day${marks.length ? " has-ms" : ""}${sameDay(date, today) ? " today" : ""}" data-day="${ymd(date)}" type="button">${day}${preview}${extra}</button>`);
  }
  board.className = "month-grid";
  board.innerHTML = weekdayLabels().map((name) => `<div class="dow">${escapeHtml(name)}</div>`).join("") + cells.join("");
}

function loadTreeDisclosure() {
  try {
    const value = JSON.parse(window.localStorage.getItem("focusflow.treeDisclosure") || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function disclosureForProject() {
  const value = state.treeDisclosure[state.selectedProjectId];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function treeExpanded(node) {
  const preferences = state.search.trim() ? state.searchDisclosure : disclosureForProject();
  return preferences[node.task_id] !== false;
}

function setTreeExpanded(ids, expanded) {
  if (!state.selectedProjectId) return;
  if (state.search.trim()) {
    state.searchDisclosure = { ...state.searchDisclosure, ...Object.fromEntries(ids.map(id => [id, expanded])) };
  } else {
    const preferences = { ...disclosureForProject(), ...Object.fromEntries(ids.map(id => [id, expanded])) };
    state.treeDisclosure = { ...state.treeDisclosure, [state.selectedProjectId]: preferences };
    cacheTreeDisclosure();
    state.treeDisclosureDirty = true;
    void saveTreeDisclosure();
  }
}

function cacheTreeDisclosure() {
  try { window.localStorage.setItem("focusflow.treeDisclosure", JSON.stringify(state.treeDisclosure)); }
  catch { /* The service remains the durable source when browser storage is unavailable. */ }
}

function saveTreeDisclosure() {
  if (state.treeDisclosurePromise) return state.treeDisclosurePromise;
  if (!state.treeDisclosureDirty) return Promise.resolve();
  state.treeDisclosureSaving = true;
  state.treeDisclosurePromise = (async () => {
    try {
      while (state.treeDisclosureDirty) {
        state.treeDisclosureDirty = false;
        // This metadata-only patch leaves routine and other focusflow preferences intact.
        await requestJson("/api/scheduler/config", { method: "PUT", body: JSON.stringify({ focusflow: { treeDisclosure: state.treeDisclosure } }) });
      }
    } catch {
      state.treeDisclosureDirty = true;
      showToast(t("treeSaveFailed"));
    } finally {
      state.treeDisclosureSaving = false;
      state.treeDisclosurePromise = null;
    }
  })();
  return state.treeDisclosurePromise;
}

function treeId(kind, taskId) {
  return `tree-${kind}-${encodeURIComponent(taskId)}`;
}

function matchesTree(node) {
  return matchesSearch(node) || (node.children || []).some(matchesTree);
}

function treeProgress(node) {
  const leaves = collectLeaves(node);
  return t("treeProgress", { done: leaves.filter(leaf => leaf.status === "DONE").length, total: leaves.length });
}

function reorderButtons(node, siblings, horizontal = false) {
  const index = siblings.findIndex(item => item.task_id === node.task_id);
  const busy = state.reordering || state.pendingStatus.size > 0;
  const title = taskTitle(node);
  return `<span class="tree-order" role="group" aria-label="${escapeHtml(t("treeOrder"))}">${[-1, 1].map(direction => {
    const label = t(horizontal ? (direction < 0 ? "moveLeft" : "moveRight") : (direction < 0 ? "moveUp" : "moveDown"), { title });
    const disabled = busy || (direction < 0 ? index === 0 : index === siblings.length - 1);
    return `<button type="button" id="${treeId(direction < 0 ? "previous" : "next", node.task_id)}" data-tree-move="${escapeHtml(node.task_id)}" data-direction="${direction}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${disabled ? "disabled" : ""}>${horizontal ? (direction < 0 ? "←" : "→") : (direction < 0 ? "↑" : "↓")}</button>`;
  }).join("")}</span>`;
}

function treeLeaf(node, siblings) {
  const minutes = Math.round(Number(node.estimated_time || 0) * 60);
  return `<li class="tree-leaf ${nodeKind(node)}" data-tree-leaf-id="${escapeHtml(node.task_id)}">
    <div class="tree-leaf-label"><span>${escapeHtml(t("treeChecklist"))}</span>${reorderButtons(node, siblings)}</div>
    ${checklistRows(node)}
    <div class="tree-leaf-meta">${escapeHtml(t("treeMinutes", { minutes }))}${node.deadline ? ` · ${escapeHtml(t("due", { date: node.deadline }))}` : ""}</div>
  </li>`;
}

function treeTask(node, siblings, inheritedMatch) {
  const expanded = treeExpanded(node);
  const children = node.children || [];
  const showAll = inheritedMatch || matchesSearch(node);
  const visible = children.filter(child => showAll || matchesTree(child));
  return `<section class="tree-task ${nodeKind(node)}" data-tree-task-id="${escapeHtml(node.task_id)}">
    <div class="tree-task-head">
      <button class="tree-toggle" type="button" id="${treeId("toggle", node.task_id)}" data-tree-toggle="${escapeHtml(node.task_id)}" aria-expanded="${expanded}" aria-controls="${treeId("children", node.task_id)}">
        <span class="tree-chevron" aria-hidden="true">›</span><span><small>${escapeHtml(t("treeTask"))}</small><strong>${escapeHtml(taskTitle(node))}</strong><span class="tree-count">${escapeHtml(treeProgress(node))}</span></span>
      </button>${reorderButtons(node, siblings)}
    </div>
    <div id="${treeId("children", node.task_id)}" ${expanded ? "" : "hidden"}>
      ${taskDescription(node) ? `<p class="tree-description">${escapeHtml(taskDescription(node))}</p>` : ""}
      <ul class="tree-checklist">${visible.map(child => treeLeaf(child, children)).join("")}</ul>
    </div>
  </section>`;
}

function renderTaskTree() {
  const board = document.getElementById("board");
  board.className = "task-tree-board";
  const stages = state.tree?.children || [];
  const projectMatches = state.tree && matchesSearch(state.tree);
  const visible = stages.filter(stage => projectMatches || matchesTree(stage));
  board.innerHTML = visible.length ? visible.map(stage => {
    const expanded = treeExpanded(stage);
    const children = stage.children || [];
    const showAll = projectMatches || matchesSearch(stage);
    const tasks = children.filter(child => showAll || matchesTree(child));
    const number = String(stages.indexOf(stage) + 1).padStart(2, "0");
    return `<article class="tree-stage ${nodeKind(stage)}" data-tree-stage-id="${escapeHtml(stage.task_id)}">
      <div class="tree-stage-header">
        <div class="tree-stage-kicker"><span>${escapeHtml(t("treeStage", { number }))}</span>${reorderButtons(stage, stages, true)}</div>
        <button class="tree-toggle" type="button" id="${treeId("toggle", stage.task_id)}" data-tree-toggle="${escapeHtml(stage.task_id)}" aria-expanded="${expanded}" aria-controls="${treeId("children", stage.task_id)}">
          <span class="tree-chevron" aria-hidden="true">›</span><span><strong>${escapeHtml(taskTitle(stage))}</strong><span class="tree-count">${escapeHtml(t("treeTaskCount", { count: children.length }))} · ${escapeHtml(treeProgress(stage))}</span></span>
        </button>
      </div>
      <div class="tree-stage-children" id="${treeId("children", stage.task_id)}" ${expanded ? "" : "hidden"}>
        ${tasks.map(node => treeTask(node, children, showAll)).join("")}
      </div>
    </article>`;
  }).join("") : `<div class="empty tree-empty">${escapeHtml(t(state.tree ? "noMatch" : "emptyTree"))}</div>`;
  board.setAttribute("aria-busy", String(state.reordering));
}

async function moveTreeNode(taskId, direction) {
  if (state.reordering || state.pendingStatus.size || ![-1, 1].includes(direction)) return;
  const parent = walkNodes(state.tree).find(node => node.children?.some(child => child.task_id === taskId));
  if (!parent) return;
  const taskIds = parent.children.map(node => node.task_id);
  const index = taskIds.indexOf(taskId);
  const target = index + direction;
  if (target < 0 || target >= taskIds.length) return;
  [taskIds[index], taskIds[target]] = [taskIds[target], taskIds[index]];
  state.reordering = true;
  renderAll();
  try {
    await saveTreeDisclosure();
    await requestJson("/api/scheduler/tasks/reorder", { method: "POST", body: JSON.stringify({ taskIds }) });
    await fetchTree(true);
    showToast(t("orderSaved"));
  } catch {
    await fetchTree(false);
    showToast(t("orderFailed"));
  } finally {
    state.reordering = false;
    renderAll();
  }
}

function renderBoard() {
  const board = document.getElementById("board");
  const scrollLeft = board.scrollLeft;
  const content = document.querySelector(".content");
  const scrollTop = content.scrollTop;
  const treeView = state.nav === "tree";
  document.getElementById("calendar-pager").hidden = treeView;
  document.getElementById("tree-controls").hidden = !treeView;
  if (treeView) {
    document.getElementById("board-title").textContent = t("taskTree");
    document.getElementById("calendar-note").textContent = t("treeHint");
    renderTaskTree();
    board.scrollLeft = scrollLeft;
    content.scrollTop = scrollTop;
    if (state.boardFocusId) {
      let target = document.getElementById(state.boardFocusId);
      if (target?.disabled && target.dataset.treeMove) {
        target = document.getElementById(treeId("toggle", target.dataset.treeMove)) || document.getElementById(treeId("check", target.dataset.treeMove));
      }
      target?.focus({ preventScroll: true });
    }
    return;
  }
  board.removeAttribute("aria-busy");
  const plan = state.plan || [];
  const focus = state.focus;
  const rangeStart = state.nav === "timeline" ? mondayOf(focus) : state.nav === "calendar" ? new Date(focus.getFullYear(), focus.getMonth(), 1) : focus;
  const rangeEnd = state.nav === "timeline" ? addDays(rangeStart, 6) : state.nav === "calendar" ? new Date(focus.getFullYear(), focus.getMonth() + 1, 0) : focus;
  const breaks = state.breaks.filter((slot) => slot.date >= ymd(rangeStart) && slot.date <= ymd(rangeEnd));
  document.getElementById("calendar-note").textContent = breaks.length ? t("breakCount", { count: breaks.length, minutes: breaks.reduce((sum, slot) => sum + minutesFromClock(slot.end) - minutesFromClock(slot.start), 0) }) : "";
  const title = state.nav === "day" ? "boardDay" : state.nav === "calendar" ? "boardCalendar" : "boardTimeline";
  document.getElementById("board-title").textContent = t(title);
  document.getElementById("cal-prev").setAttribute("aria-label", t("prevPeriod"));
  document.getElementById("cal-next").setAttribute("aria-label", t("nextPeriod"));
  if (state.nav === "day") {
    document.getElementById("range-label").textContent = new Intl.DateTimeFormat(localeTag(), { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(focus);
    renderDay(plan);
  } else if (state.nav === "calendar") {
    document.getElementById("range-label").textContent = new Intl.DateTimeFormat(localeTag(), { year: "numeric", month: "long" }).format(focus);
    renderMonth(plan);
  } else {
    const start = mondayOf(focus);
    document.getElementById("range-label").textContent = `${formatDate(start)} - ${formatDate(addDays(start, 6))}`;
    renderTimeline(plan);
  }
}


function renderScheduleButton() {
  const button = document.getElementById("open-schedule");
  const label = `${t("workSchedule")} ${clock(state.periodStart)}–${clock(state.periodEnd)}`;
  button.textContent = label;
  button.setAttribute("aria-label", label);
}

function renderAll() {
  if (!state.focus) state.focus = startOfDay(new Date());
  state.plan = scheduleProjects(state.projects);
  ensureSelection();
  renderSidebar();
  renderHeader();
  const source = document.getElementById("project-source");
  const selected = state.projects.find((project) => project.tree.task_id === state.selectedProjectId);
  source.hidden = selected?.generationMode !== "sample";
  source.innerHTML = source.hidden ? "" : `<span class="source-badge">${escapeHtml(t("sampleBadge"))}</span>`;
  renderBoard();
  renderScheduleButton();
  renderDayGrainButton();
}

function deadlineMemory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("focusflow.deadlines") || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rememberDeadline(taskId, amount, unit) {
  if (!taskId) return;
  const all = deadlineMemory();
  all[taskId] = { amount, unit };
  window.localStorage.setItem("focusflow.deadlines", JSON.stringify(all));
}

function selectProject(projectId) {
  const project = state.projects.find((item) => item.tree.task_id === projectId) || null;
  state.selectedProjectId = project ? project.tree.task_id : null;
  state.tree = project ? project.tree : null;
  state.horizonDays = project && project.deadline_days ? Number(project.deadline_days) : null;
  if (project && project.persona) state.persona = project.persona;
  const memory = project ? deadlineMemory()[project.tree.task_id] : null;
  if (memory) {
    state.deadlineAmount = memory.amount;
    state.deadlineUnit = memory.unit || "week";
  }
}

function ingestProjects(list, preferredId) {
  state.projects = (list || []).map((project, index) => ({
    ...project,
    deadline_days: project.deadline_days || null,
    color: PROJECT_COLORS[index % PROJECT_COLORS.length],
  }));
  const chosen = state.projects.find((item) => item.tree.task_id === preferredId)
    || state.projects[state.projects.length - 1]
    || null;
  selectProject(chosen ? chosen.tree.task_id : null);
}

function showSyncError(message) {
  const warning = document.getElementById("sync-warning");
  warning.hidden = !message;
  warning.textContent = message || "";
}

function timezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
}

function readableError(error) {
  const known = {
    MODEL_NOT_CONFIGURED: "modelNotConfigured",
    MODEL_AUTH_FAILED: "modelAuthFailed",
    MODEL_RATE_LIMITED: "modelRateLimited",
    MODEL_TIMEOUT: "modelTimeout",
    MODEL_RESPONSE_INVALID: "modelResponseInvalid",
    MODEL_UNAVAILABLE: "modelUnavailable",
    STALE_DRAFT: "staleDraft",
    DRAFT_EXPIRED: "draftExpired",
    DRAFT_CANCELLED: "draftExpired",
  };
  return known[error.code] ? t(known[error.code]) : error.message;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error?.message || (typeof payload?.detail === "string" ? payload.detail : t("planFailed", { status: response.status })));
    error.code = payload?.error?.code || "HTTP_ERROR";
    error.status = response.status;
    throw error;
  }
  return payload?.ok === true ? payload.data : payload;
}

async function fetchTree(showErrors = false, preferredId = null) {
  const token = ++state.loadToken;
  try {
    const [payload, timeline] = await Promise.all([
      requestJson("/api/v1/projects"),
      requestJson(`/api/scheduler/timeline?projectId=all&timezone=${encodeURIComponent(timezone())}`),
    ]);
    if (token !== state.loadToken) return false;
    state.slots = timeline.slots || timeline.events || [];
    state.breaks = timeline.breaks || [];
    ingestProjects(payload.projects, preferredId || state.selectedProjectId);
    renderAll();
    showSyncError("");
    maybePromptDayGrain();
    ensureLocaleCopy();
    return true;
  } catch (error) {
    if (token !== state.loadToken) return false;
    showSyncError(t("syncFailed"));
    if (showErrors) showToast(readableError(error));
    return false;
  }
}

async function initializePlan(event) {
  event.preventDefault();
  if (state.inflight) return;
  const goal = document.getElementById("goal").value.trim();
  const persona = document.getElementById("persona").value;
  const amount = Number(document.getElementById("deadline-amount").value);
  const unit = document.getElementById("deadline-unit").value;
  const deadlineDays = spanDays(amount, unit);
  if (!goal) return showToast(t("needGoal"));
  if (!deadlineDays) return showToast(t("needDeadline"));
  const projectId = state.formMode === "revise" ? state.reviseTaskId : null;
  await generateDraft({
    path: "/api/scheduler/plans/preview", kind: "plan", deadline: { amount, unit },
    body: { goal, persona, deadline_days: deadlineDays, projectId, timezone: timezone(),
      granularity: { micro: "finer", balanced: "standard", macro: "coarser" }[persona],
      availability: sharedDeskBody(), allowSample: document.getElementById("plan-source").value === "sample" },
  });
}

async function generateDraft(request) {
  state.generationController?.abort();
  toast.classList.remove("visible");
  const token = ++state.generationToken;
  const controller = new AbortController();
  state.generationController = controller;
  state.previewRequest = request;
  setBusy(true);
  setDecomposing(true);
  document.getElementById("generation-error").hidden = true;
  document.getElementById("generation-retry").hidden = true;
  document.querySelector(".stripe-track").hidden = false;
  document.getElementById("generation-cancel").focus();
  try {
    // Finish preference writes before the service takes the draft's revision snapshot.
    await saveTreeDisclosure();
    if (token !== state.generationToken || controller.signal.aborted) return;
    const draft = await requestJson(request.path, { method: "POST", body: JSON.stringify(request.body), signal: controller.signal });
    if (token !== state.generationToken) {
      if (draft?.draftId) void requestJson(`/api/scheduler/plans/${encodeURIComponent(draft.draftId)}`, { method: "DELETE" }).catch(() => {});
      return;
    }
    if (!draft?.draftId || !Number.isInteger(draft.baseRevision)) throw new Error(t("generationFailed"));
    state.draft = { ...draft, requestId: crypto.randomUUID(), context: request };
    setDecomposing(false);
    showDraft();
  } catch (error) {
    if (token !== state.generationToken || error.name === "AbortError") return;
    document.getElementById("decompose-label").textContent = t("generationFailed");
    document.getElementById("generation-error").textContent = readableError(error);
    document.getElementById("generation-error").hidden = false;
    document.getElementById("generation-retry").hidden = false;
    document.querySelector(".stripe-track").hidden = true;
    document.getElementById("generation-retry").focus();
  } finally {
    if (token === state.generationToken) {
      state.generationController = null;
      setBusy(false);
    }
  }
}

function cancelGeneration() {
  ++state.generationToken;
  state.generationController?.abort();
  state.generationController = null;
  setBusy(false);
  setDecomposing(false);
  showToast(t("generationCancelled"));
  if (modal.classList.contains("open")) document.getElementById("goal").focus();
}

function draftTreeHtml(node, depth = 0) {
  const label = t("draftLevels")[Math.min(depth, 3)];
  const statuses = { PENDING: "pendingStatus", IN_PROGRESS: "activeStatus", DONE: "doneStatus", BLOCKED: "blockedStatus", SKIPPED: "skippedStatus" };
  const content = `<strong>${escapeHtml(label)}</strong> · ${escapeHtml(taskTitle(node))}<small>${escapeHtml(t(statuses[node.status] || "pendingStatus"))} · ${Math.round(Number(node.estimated_time || 0) * 60)} min</small>`;
  if (!node.children?.length) return `<li>${content}</li>`;
  return `<li><details ${depth < 2 ? "open" : ""}><summary>${content}</summary><ul class="draft-tree">${node.children.map((child) => draftTreeHtml(child, depth + 1)).join("")}</ul></details></li>`;
}

function impactMetric(label, value) {
  return `<div class="impact-metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function routineDescription(routine) {
  if (!routine) return "";
  let html = `<p><strong>${escapeHtml(routine.workStart || "")}–${escapeHtml(routine.workEnd || "")}</strong></p>`;
  html += Number.isFinite(routine.focusMinutes)
    ? `<p>${escapeHtml(t("cycleShort", { focus: routine.focusMinutes, rest: routine.breakMinutes ?? 0 }))}</p><p>${escapeHtml(t("cycleLong", { cycles: routine.cyclesBeforeRecovery ?? 4, rest: routine.recoveryMinutes ?? 0 }))}</p>`
    : `<p>${escapeHtml(t("noCycle"))}</p>`;
  return html;
}

function draftImpactHtml(draft) {
  const summary = draft.changeSummary;
  if (!summary) return "";
  if (draft.context.kind === "granularity") {
    return `<div class="impact-metrics">${impactMetric(t("checklistCount"), `${summary.beforeCount} → ${summary.afterCount}`)}${impactMetric(t("estimateMinutes"), `${summary.beforeMinutes} → ${summary.afterMinutes}`)}${impactMetric(t("protectedCount"), summary.preservedCount)}</div><p class="impact-note">${escapeHtml(t("targetStep"))} · ${escapeHtml(t("minuteValue", { minutes: summary.targetMinutes }))}</p>`;
  }
  if (draft.context.kind === "routine") {
    return `<div class="before-after"><div><h3>${escapeHtml(t("beforeLabel"))}</h3>${routineDescription(draft.beforeRoutine)}</div><div><h3>${escapeHtml(t("afterLabel"))}</h3>${routineDescription(draft.suggestion || draft.context.body)}</div></div><div class="impact-metrics">${impactMetric(t("movedTasks"), summary.movedCount ?? 0)}${impactMetric(t("totalWorkMinutes"), t("minuteValue", { minutes: summary.workMinutes ?? 0 }))}${impactMetric(t("totalBreakMinutes"), t("minuteValue", { minutes: summary.breakMinutes ?? 0 }))}</div><p class="impact-note">${escapeHtml(t("totalSchedule"))} ${summary.availableMinutesPerDay != null ? escapeHtml(t("availableWindow", { minutes: summary.availableMinutesPerDay })) : ""}${summary.overflowCount ? ` · ${escapeHtml(t("overflowTasks", { count: summary.overflowCount }))}` : ""}</p>`;
  }
  return "";
}

function showDraft() {
  const draft = state.draft;
  if (!draft) return;
  const kind = draft.context.kind;
  document.getElementById("draft-title").textContent = t(kind === "routine" ? "routineDraftTitle" : kind === "granularity" ? "grainDraftTitle" : "draftTitle");
  const chips = [];
  if (draft.generationMode === "sample") chips.push(t("sampleBadge"));
  if (draft.tree) chips.push(t("draftTasks", { count: collectLeaves(draft.tree).length }));
  chips.push(t("draftSlots", { count: (draft.proposedSlots || []).filter((slot) => !slot.kind || slot.kind === "work").length }));
  if (draft.affectedTasks) chips.push(t("adjustedTasks", { count: draft.affectedTasks.length }));
  document.getElementById("draft-summary").innerHTML = chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join("");
  document.getElementById("draft-impact").innerHTML = draftImpactHtml(draft);
  const warnings = (draft.warnings || []).map((message) => message.startsWith("Duration-based adjustment only;") ? t("durationAdjustment") : message);
  if (kind === "granularity" || draft.context.body.projectId) warnings.unshift(t("preservedDone"));
  if (draft.canCommit === false) warnings.unshift(t("noDraftChange"));
  const warning = document.getElementById("draft-warnings");
  warning.hidden = warnings.length === 0;
  warning.textContent = warnings.join(" · ");
  let content = "";
  if (kind === "routine") {
    const routine = draft.context.body;
    content += `<p class="hint">${escapeHtml(routine.rest || t("restSlotHint"))}</p><details><summary>${escapeHtml(t("affectedDetails"))}</summary><ul>${(draft.affectedTasks || []).map((task) => `<li>${escapeHtml(task.title)}</li>`).join("")}</ul></details>`;
  } else if (kind === "granularity") {
    const changes = draft.changeSummary?.changes || [];
    content += `<details open><summary>${escapeHtml(t("changesTitle"))}</summary><ol class="change-list">${changes.map((change) => `<li><p class="before">${escapeHtml((change.beforeTitles || []).join(" / "))} · ${change.beforeMinutes} min</p><p>${escapeHtml(t("changeTo"))} → ${escapeHtml((change.afterTitles || []).join(" / "))} · ${change.afterMinutes} min</p></li>`).join("")}</ol></details>`;
    if (draft.tree) content += `<details><summary>${escapeHtml(t("wholeTree"))}</summary><ul class="draft-tree">${draftTreeHtml(draft.tree)}</ul></details>`;
  } else if (draft.tree) content += `<ul class="draft-tree">${draftTreeHtml(draft.tree)}</ul>`;
  const slots = draft.proposedSlots || [];
  const titles = new Map(walkNodes(draft.tree).map((node) => [node.task_id, taskTitle(node)]));
  content += `<details><summary>${escapeHtml(t("slotsTitle"))}</summary><div class="draft-slots">${slots.slice(0, 80).map((slot) => `<div>${escapeHtml(slot.date || String(slot.startTime || "").slice(0, 10))} ${escapeHtml(slot.start || String(slot.startTime || "").slice(11, 16))}–${escapeHtml(slot.end || String(slot.endTime || "").slice(11, 16))} · ${escapeHtml(slot.kind === "recovery" ? t("longBreak") : slot.kind === "break" ? t("shortBreak") : titles.get(slot.taskId) || slot.title || slot.taskId)}</div>`).join("") || escapeHtml(t("emptySlots"))}${slots.length > 80 ? `<p>${escapeHtml(t("moreSlots", { count: slots.length - 80 }))}</p>` : ""}</div></details>`;
  document.getElementById("draft-content").innerHTML = content;
  document.getElementById("draft-error").hidden = true;
  document.getElementById("draft-regenerate").hidden = true;
  document.getElementById("draft-commit").disabled = draft.canCommit === false;
  document.getElementById("draft-commit").textContent = t("confirmDraft");
  const dialog = document.getElementById("draft-dialog");
  if (!dialog.open) dialog.showModal();
  document.getElementById(draft.canCommit === false ? "draft-cancel" : "draft-commit").focus();
}

async function discardDraft(announce = true) {
  if (state.committing) return;
  const draft = state.draft;
  state.draft = null;
  document.getElementById("draft-dialog").close();
  if (draft) {
    try { await requestJson(`/api/scheduler/plans/${encodeURIComponent(draft.draftId)}`, { method: "DELETE" }); }
    catch { /* An uncommitted draft never changes the saved plan. */ }
  }
  if (announce) showToast(t("generationCancelled"));
}

async function commitDraft() {
  const draft = state.draft;
  if (!draft || draft.canCommit === false || state.committing) return;
  state.committing = true;
  const button = document.getElementById("draft-commit");
  button.disabled = true;
  button.textContent = t("savingDraft");
  document.getElementById("draft-cancel").disabled = true;
  document.getElementById("draft-error").hidden = true;
  try {
    const result = await requestJson(`/api/scheduler/plans/${encodeURIComponent(draft.draftId)}/commit`, {
      method: "POST", body: JSON.stringify({ expectedRevision: draft.baseRevision, requestId: draft.requestId }),
    });
    if (draft.context.deadline && result.tree?.task_id) {
      rememberDeadline(result.tree.task_id, draft.context.deadline.amount, draft.context.deadline.unit);
    }
    if (draft.context.kind === "routine") {
      const desk = draft.context.body.focusflow;
      persistMeals(desk.lunchStart, desk.lunchEnd, desk.dinnerStart, desk.dinnerEnd);
      persistSchedule(desk.hoursPerDay, desk.periodStart, desk.periodEnd);
      if (desk.persona) { state.persona = desk.persona; window.localStorage.setItem("focusflow.persona", desk.persona); }
      state.hasSharedRoutine = true;
      if (draft.context.entry) entryModal.classList.remove("open");
    }
    if (draft.context.kind === "granularity") state.monitor = null;
    state.draft = null;
    document.getElementById("draft-dialog").close();
    [modal, scheduleModal, document.getElementById("grain-modal"), document.getElementById("focus-modal"), document.getElementById("grain-suggest-modal")].forEach((element) => element.classList.remove("open"));
    showToast(t("draftConfirmed"));
    await pullSharedDesk();
    await fetchTree(true, result.tree?.task_id || state.selectedProjectId);
    if (draft.context.entry && state.monitor) openDayGrain();
  } catch (error) {
    const expired = ["STALE_DRAFT", "DRAFT_EXPIRED", "DRAFT_CANCELLED"].includes(error.code);
    const alert = document.getElementById("draft-error");
    alert.textContent = expired ? readableError(error) : `${t("saveFailed")} ${readableError(error)}`;
    alert.hidden = false;
    document.getElementById("draft-regenerate").hidden = !expired;
    button.disabled = expired;
    button.textContent = t("retry");
  } finally {
    state.committing = false;
    document.getElementById("draft-cancel").disabled = false;
  }
}

function openPlanModal(mode, taskId) {
  const revising = mode === "revise";
  state.formMode = revising ? "revise" : "new";
  state.reviseTaskId = revising ? taskId : null;
  document.getElementById("modal-title").dataset.i18n = revising ? "revisePlan" : "newPlan";
  document.getElementById("modal-intro").dataset.i18n = revising ? "reviseIntro" : "modalIntro";
  initButton.dataset.i18n = revising ? "resplit" : "generateTimeline";
  if (revising) {
    selectProject(taskId);
    renderSidebar();
    const project = state.projects.find((item) => item.tree.task_id === taskId);
    document.getElementById("goal").value = project ? taskTitle(project.tree) : "";
    document.getElementById("persona").value = project?.persona || state.persona || "balanced";
    const amount = document.getElementById("deadline-amount");
    const unit = document.getElementById("deadline-unit");
    const memory = deadlineMemory()[taskId];
    if (memory) {
      amount.value = String(memory.amount);
      unit.value = memory.unit || "week";
    } else if (project && project.deadline_days) {
      amount.value = String(project.deadline_days);
      unit.value = "day";
    }
  }
  applyStaticCopy();
  modal.classList.add("open");
  document.getElementById("goal").focus();
}

async function updateTaskStatus(taskId, status) {
  if (state.pendingStatus.has(taskId)) return;
  state.pendingStatus.add(taskId);
  renderAll();
  try {
    await saveTreeDisclosure();
    await requestJson(`/api/v1/tasks/${encodeURIComponent(taskId)}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    });
    if (status === "DONE" || status === "IN_PROGRESS") noteActualWork(taskId, status);
    await fetchTree(true);
    showToast(t("stepSaved"));
  } catch (error) { showToast(readableError(error)); }
  finally { state.pendingStatus.delete(taskId); renderAll(); }
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws/tree?scope=all`);
  socket.addEventListener("close", () => window.setTimeout(connectWebSocket, 1200));
  socket.addEventListener("error", () => socket.close());
  socket.addEventListener("message", (rawEvent) => {
    const payload = JSON.parse(rawEvent.data);
    if (["NEW_TASK", "TREE_MUTATED", "TASK_STATUS_UPDATED"].includes(payload.event_type)) {
      fetchTree(false);
    }
  });
  state.ws = socket;
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => setLocale(button.dataset.lang));
});
document.getElementById("open-modal").addEventListener("click", () => openPlanModal("new"));
document.getElementById("open-modal-secondary").addEventListener("click", () => openPlanModal("new"));
document.getElementById("project-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-id]");
  if (!button) return;
  selectProject(button.dataset.projectId);
  renderAll();
});
document.getElementById("revise-current").addEventListener("click", () => {
  if (!state.selectedProjectId) return;
  openPlanModal("revise", state.selectedProjectId);
});
document.getElementById("cancel-modal").addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.classList.remove("open");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (document.getElementById("draft-dialog").open) return;
    if (document.getElementById("decompose-overlay").classList.contains("open")) { cancelGeneration(); return; }
    modal.classList.remove("open");
    scheduleModal.classList.remove("open");
    if (document.getElementById("focus-modal").classList.contains("open")) dismissFocusSuggestion();
    if (document.getElementById("grain-suggest-modal").classList.contains("open")) dismissDayGrainSuggestion();
    document.getElementById("grain-modal").classList.remove("open");
  }
});
const scheduleModal = document.getElementById("schedule-modal");
const scheduleForm = document.getElementById("schedule-form");
const entryModal = document.getElementById("entry-modal");
const entryForm = document.getElementById("entry-form");
function minutesFromClock(value) {
  const [hours, mins] = String(value || "").split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(mins)) return null;
  return hours * 60 + mins;
}
function mealsFromIds(lunchStartId, lunchEndId, dinnerStartId, dinnerEndId) {
  return mealRanges([
    { start: minutesFromClock(document.getElementById(lunchStartId).value), end: minutesFromClock(document.getElementById(lunchEndId).value) },
    { start: minutesFromClock(document.getElementById(dinnerStartId).value), end: minutesFromClock(document.getElementById(dinnerEndId).value) },
  ].filter((meal) => meal.start != null && meal.end != null));
}
function draftMeals() {
  return mealsFromIds("lunch-start", "lunch-end", "dinner-start", "dinner-end");
}
function entryMeals() {
  return mealsFromIds("entry-lunch-start", "entry-lunch-end", "entry-dinner-start", "entry-dinner-end");
}
function showFieldError(errorEl, inputs, key, hintId) {
  const invalid = Boolean(key);
  inputs.forEach((input) => {
    input.classList.toggle("conflict", invalid);
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
    input.setAttribute("aria-describedby", invalid ? `${hintId} ${errorEl.id}` : hintId);
  });
  errorEl.hidden = !invalid;
  errorEl.textContent = invalid ? t(key) : "";
  return invalid;
}
function bindMealRange(startId, endId, errorId, hintId) {
  const startInput = document.getElementById(startId);
  const endInput = document.getElementById(endId);
  const errorEl = document.getElementById(errorId);
  function sync() {
    const start = minutesFromClock(startInput.value);
    const end = minutesFromClock(endInput.value);
    const key = start == null || end == null || start >= end ? "rangeOrder" : "";
    return showFieldError(errorEl, [startInput, endInput], key, hintId);
  }
  startInput.addEventListener("input", () => refreshScheduleForms());
  endInput.addEventListener("input", () => refreshScheduleForms());
  return { sync };
}
function bindWorkPeriod(hoursId, startId, endId, errorId, hintId, mealReader) {
  const hoursInput = document.getElementById(hoursId);
  const startInput = document.getElementById(startId);
  const endInput = document.getElementById(endId);
  const errorEl = document.getElementById(errorId);
  let endManual = false;
  function sync(forceEnd) {
    const hours = Number(hoursInput.value);
    const ready = hours >= 0.5 && hours <= 16;
    startInput.disabled = !ready;
    endInput.disabled = !ready;
    if (!ready) {
      showFieldError(errorEl, [startInput, endInput], "", hintId);
      return "hours";
    }
    const start = minutesFromClock(startInput.value);
    const meals = mealReader();
    const minutes = Math.round(hours * 60);
    if (!endManual || forceEnd) {
      const nextEnd = start == null ? null : endAfterWork(start, minutes, meals);
      endInput.value = nextEnd == null ? "" : clock(nextEnd);
    }
    const end = minutesFromClock(endInput.value);
    let key = "";
    if (start == null || end == null || start >= end) key = "rangeOrder";
    else if (workableMinutes(start, end, meals) !== minutes) key = "hoursMismatch";
    showFieldError(errorEl, [startInput, endInput], key, hintId);
    return key;
  }
  hoursInput.addEventListener("input", () => { endManual = false; refreshScheduleForms(true); });
  startInput.addEventListener("input", () => { endManual = false; refreshScheduleForms(true); });
  endInput.addEventListener("input", () => { endManual = true; refreshScheduleForms(false); });
  return {
    sync,
    keepEnd() { endManual = true; return sync(false); },
  };
}
const scheduleLunch = bindMealRange("lunch-start", "lunch-end", "lunch-error", "schedule-hint");
const scheduleDinner = bindMealRange("dinner-start", "dinner-end", "dinner-error", "schedule-hint");
const entryLunch = bindMealRange("entry-lunch-start", "entry-lunch-end", "entry-lunch-error", "entry-hint");
const entryDinner = bindMealRange("entry-dinner-start", "entry-dinner-end", "entry-dinner-error", "entry-hint");
const schedulePeriod = bindWorkPeriod("hours-per-day", "period-start", "period-end", "period-error", "schedule-hint", draftMeals);
const entryPeriod = bindWorkPeriod("entry-hours", "entry-start", "entry-end", "entry-period-error", "entry-hint", entryMeals);
function refreshScheduleForms(forceEnd) {
  const recalc = forceEnd !== false;
  const scheduleLunchBad = scheduleLunch.sync();
  const scheduleDinnerBad = scheduleDinner.sync();
  const scheduleKey = schedulePeriod.sync(recalc);
  const entryLunchBad = entryLunch.sync();
  const entryDinnerBad = entryDinner.sync();
  const entryKey = entryPeriod.sync(recalc);
  const blockedPeriod = ["rangeOrder", "hours", "hoursMismatch"];
  document.getElementById("save-schedule").disabled = scheduleLunchBad || scheduleDinnerBad || blockedPeriod.includes(scheduleKey);
  document.getElementById("enter-planner").disabled = entryLunchBad || entryDinnerBad || blockedPeriod.includes(entryKey);
}
function focusInvalid(dialog) {
  const invalid = dialog.querySelector("[aria-invalid='true']");
  if (invalid && !invalid.disabled) {
    const collapsed = invalid.closest("details");
    if (collapsed) collapsed.open = true;
    invalid.focus();
  }
}
function fillScheduleForm() {
  fillCycleForm("routine");
  document.getElementById("routine-rest").value = state.rest || "";
  document.getElementById("hours-per-day").value = String(state.hoursPerDay);
  document.getElementById("lunch-start").value = clock(state.lunchStart);
  document.getElementById("lunch-end").value = clock(state.lunchEnd);
  document.getElementById("dinner-start").value = clock(state.dinnerStart);
  document.getElementById("dinner-end").value = clock(state.dinnerEnd);
  document.getElementById("period-start").value = clock(state.periodStart);
  document.getElementById("period-end").value = clock(state.periodEnd);
  schedulePeriod.keepEnd();
  refreshScheduleForms(false);
}
function persistMeals(lunchStart, lunchEnd, dinnerStart, dinnerEnd) {
  state.lunchStart = lunchStart;
  state.lunchEnd = lunchEnd;
  state.dinnerStart = dinnerStart;
  state.dinnerEnd = dinnerEnd;
  window.localStorage.setItem("focusflow.lunchStart", String(lunchStart));
  window.localStorage.setItem("focusflow.lunchEnd", String(lunchEnd));
  window.localStorage.setItem("focusflow.dinnerStart", String(dinnerStart));
  window.localStorage.setItem("focusflow.dinnerEnd", String(dinnerEnd));
}
function persistSchedule(hours, start, end) {
  state.hoursPerDay = hours;
  state.periodStart = start;
  state.periodEnd = end;
  window.localStorage.setItem("focusflow.hoursPerDay", String(hours));
  window.localStorage.setItem("focusflow.periodStart", String(start));
  window.localStorage.setItem("focusflow.periodEnd", String(end));
}
function formatHours(hours) {
  const rounded = Math.round(Number(hours) * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
function minuteInWindow(minute, start, end) {
  if (minute < start || minute >= end) return false;
  return !mealRanges().some((meal) => minute >= meal.start && minute < meal.end);
}
function readWorkLog() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("focusflow.workLog") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && Number.isInteger(item.minute) && item.minute >= 0 && item.minute < 24 * 60);
  } catch {
    return [];
  }
}
function focusSignature(suggestion) {
  return `${suggestion.hours}|${suggestion.start}|${suggestion.end}`;
}
function suggestFocusWindow(log) {
  const samples = log.filter((item) => Number.isInteger(item.minute));
  const outside = samples.filter((item) => !minuteInWindow(item.minute, state.periodStart, state.periodEnd));
  if (outside.length < 2) return null;
  const starts = new Set();
  for (let start = 0; start < 24 * 60; start += 30) starts.add(start);
  starts.add(state.periodStart);
  let best = null;
  starts.forEach((start) => {
    for (let steps = 1; steps <= 32; steps += 1) {
      const hours = steps / 2;
      const minutes = Math.round(hours * 60);
      const end = endAfterWork(start, minutes);
      if (end == null || end <= start || end > 24 * 60) continue;
      if (workableMinutes(start, end) !== minutes) continue;
      if (start === state.periodStart && end === state.periodEnd && hours === state.hoursPerDay) continue;
      let outsideHit = 0;
      let insideHit = 0;
      samples.forEach((item) => {
        if (!minuteInWindow(item.minute, start, end)) return;
        if (minuteInWindow(item.minute, state.periodStart, state.periodEnd)) insideHit += 1;
        else outsideHit += 1;
      });
      if (outsideHit < 1) continue;
      const covered = outsideHit + insideHit;
      const score = outsideHit * 10000 + covered * 100 + covered / hours - Math.abs(start - state.periodStart) / 100000;
      if (!best || score > best.score) best = { hours, start, end, outsideHit, score };
    }
  });
  return best;
}
function focusDialogBusy() {
  return document.getElementById("draft-dialog").open || state.committing
    || entryModal.classList.contains("open")
    || scheduleModal.classList.contains("open")
    || modal.classList.contains("open")
    || document.getElementById("decompose-overlay").classList.contains("open")
    || document.getElementById("grain-modal").classList.contains("open")
    || document.getElementById("grain-suggest-modal").classList.contains("open");
}
function maybePromptFocus() {
  if (focusDialogBusy()) return;
  const log = readWorkLog();
  const suggestion = suggestFocusWindow(log);
  if (!suggestion) return;
  if (window.localStorage.getItem("focusflow.focusDismissed") === focusSignature(suggestion)) return;
  state.focusSuggestion = suggestion;
  const count = log.filter((item) => !minuteInWindow(item.minute, state.periodStart, state.periodEnd)).length;
  document.getElementById("focus-title").textContent = t("focusTitle");
  document.getElementById("focus-copy").textContent = t("focusCopy", {
    count,
    hours: formatHours(suggestion.hours),
    start: clock(suggestion.start),
    end: clock(suggestion.end),
  });
  document.getElementById("focus-note").textContent = t("focusNote");
  document.getElementById("focus-keep").textContent = t("focusKeep");
  document.getElementById("focus-apply").textContent = t("focusApply");
  document.getElementById("focus-modal").classList.add("open");
  document.getElementById("focus-apply").focus();
}
function dismissFocusSuggestion() {
  if (state.focusSuggestion) {
    window.localStorage.setItem("focusflow.focusDismissed", focusSignature(state.focusSuggestion));
    void pushSharedDesk();
  }
  document.getElementById("focus-modal").classList.remove("open");
}
async function applyFocusSuggestion() {
  const suggestion = state.focusSuggestion;
  if (!suggestion) return;
  await generateDraft({ path: "/api/scheduler/routine/preview", kind: "routine",
    body: routineBody(suggestion.hours, suggestion.start, suggestion.end, state.lunchStart, state.lunchEnd, state.dinnerStart, state.dinnerEnd) });
}
function noteActualWork(taskId, status) {
  if (entryModal.classList.contains("open")) return;
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  const day = ymd(now);
  const key = `${day}|${taskId}|${minute}|${status}`;
  const log = readWorkLog();
  if (!log.some((item) => item.key === key)) {
    log.push({ key, taskId, minute, day, at: now.getTime(), status });
    while (log.length > 400) log.shift();
    window.localStorage.setItem("focusflow.workLog", JSON.stringify(log));
    void pushSharedDesk();
  }
  maybePromptFocus();
}
function currentDayGrain() {
  const today = ymd(startOfDay(new Date()));
  try {
    const parsed = JSON.parse(window.localStorage.getItem("focusflow.dayGrain") || "{}");
    if (parsed[today] === "fine" || parsed[today] === "wide" || parsed[today] === "steady") return parsed[today];
  } catch {
    // Keep the steady span when the saved value cannot be read.
  }
  return "steady";
}
function grainName(grain) {
  if (grain === "fine") return t("grainFineName");
  if (grain === "wide") return t("grainWideName");
  return t("grainSteadyName");
}
function renderDayGrainButton() {
  const button = document.getElementById("open-day-grain");
  const label = `${t("dayGrain")} · ${grainName(currentDayGrain())}${state.appliedGrainTarget ? ` ${state.appliedGrainTarget}m` : ""}`;
  button.textContent = label;
  button.setAttribute("aria-label", label);
}
function checklistRows(node) {
  if (node.children?.length) return node.children.map(checklistRows).join("");
  const title = taskTitle(node);
  const statuses = { PENDING: "pendingStatus", IN_PROGRESS: "activeStatus", DONE: "doneStatus", BLOCKED: "blockedStatus", SKIPPED: "skippedStatus" };
  return `<div class="check-row${node.status === "DONE" ? " done" : ""}">
    <input type="checkbox" id="${treeId("check", node.task_id)}" aria-label="${escapeHtml(title)}" data-task-id="${escapeHtml(node.task_id)}" ${node.status === "DONE" ? "checked" : ""} ${state.pendingStatus.has(node.task_id) ? "disabled" : ""} />
    <span>${escapeHtml(title)}</span>
    <select class="task-status" id="${treeId("status", node.task_id)}" data-status-task-id="${escapeHtml(node.task_id)}" aria-label="${escapeHtml(t("statusFor", { title }))}" ${state.pendingStatus.has(node.task_id) ? "disabled" : ""}>
      ${Object.entries(statuses).map(([value, key]) => `<option value="${value}" ${node.status === value ? "selected" : ""}>${escapeHtml(t(key))}</option>`).join("")}
    </select>
  </div>`;
}
function handleTaskCheck(input) {
  void updateTaskStatus(input.dataset.taskId, input.checked ? "DONE" : "PENDING");
}
function assessToday() {
  const grain = currentDayGrain();
  const today = startOfDay(new Date());
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const byId = new Map();
  (state.plan || []).forEach((item) => {
    item.slots.forEach((slot) => {
      if (!sameDay(slot.date, today)) return;
      const current = byId.get(item.node.task_id) || { item, overdue: false };
      if (item.node.status !== "DONE" && item.node.status !== "SKIPPED" && nowMin >= slot.to) current.overdue = true;
      current.item = item;
      byId.set(item.node.task_id, current);
    });
  });
  if (!byId.size) return null;
  const overdue = [...byId.values()].filter((row) => row.overdue).length;
  const done = [...byId.values()].filter((row) => row.item.node.status === "DONE").length;
  let overrun = false;
  const starts = readWorkLog().filter((entry) => entry.day === ymd(today) && entry.status === "IN_PROGRESS" && entry.at);
  byId.forEach((row) => {
    if (row.item.node.status !== "IN_PROGRESS") return;
    const latest = starts.filter((entry) => entry.taskId === row.item.node.task_id).pop();
    if (!latest) return;
    const elapsed = (Date.now() - latest.at) / 60000;
    const estimate = Math.max(1, Number(row.item.node.estimated_time || 1) * 60);
    if (elapsed > estimate) overrun = true;
  });
  if ((overdue >= 2 || overrun) && grain !== "fine") {
    return {
      direction: "fine",
      reason: overrun && overdue < 2 ? "overrun" : "overdue",
      count: Math.max(overdue, 1),
    };
  }
  if (done >= 2 && overdue === 0 && !overrun && grain !== "wide") {
    return { direction: "wide", reason: "flow", count: done };
  }
  return null;
}
function paintDayGrainSuggestion(suggestion) {
  document.getElementById("grain-suggest-title").textContent = t(suggestion.direction === "wide" ? "grainSuggestWideTitle" : "grainSuggestFineTitle");
  const key = suggestion.reason === "flow"
    ? "grainSuggestFlow"
    : suggestion.reason === "overrun"
      ? "grainSuggestOverrun"
      : "grainSuggestOverdue";
  document.getElementById("grain-suggest-copy").textContent = t(key, { count: suggestion.count });
  document.getElementById("grain-suggest-note").textContent = t("dayGrainNote");
  document.getElementById("grain-suggest-keep").textContent = t("grainSuggestKeep");
  document.getElementById("grain-suggest-apply").textContent = t("grainSuggestApply");
}
function maybePromptDayGrain() {
  if (state.monitor) return;
  const dialog = document.getElementById("grain-suggest-modal");
  if (dialog.classList.contains("open") && state.dayGrainSuggestion) {
    paintDayGrainSuggestion(state.dayGrainSuggestion);
    return;
  }
  if (focusDialogBusy()) return;
  const suggestion = assessToday();
  if (!suggestion) return;
  const signature = `${ymd(startOfDay(new Date()))}|${suggestion.direction}`;
  if (window.localStorage.getItem("focusflow.dayGrainDismissed") === signature) return;
  state.dayGrainSuggestion = suggestion;
  paintDayGrainSuggestion(suggestion);
  dialog.classList.add("open");
  document.getElementById("grain-suggest-apply").focus();
}
function dismissDayGrainSuggestion() {
  if (state.dayGrainSuggestion) {
    window.localStorage.setItem(
      "focusflow.dayGrainDismissed",
      `${ymd(startOfDay(new Date()))}|${state.dayGrainSuggestion.direction}`,
    );
    void pushSharedDesk();
  }
  document.getElementById("grain-suggest-modal").classList.remove("open");
}
async function applyDayGrain(grain) {
  const taskId = document.getElementById("grain-target").value;
  const owner = state.projects.find((project) => walkNodes(project.tree).some((node) => node.task_id === taskId));
  if (!owner) return showToast(t("noAdjustableTask"));
  const targetInput = document.getElementById("grain-target-minutes");
  if (!targetInput.reportValidity()) return;
  await generateDraft({ path: "/api/scheduler/granularity/preview", kind: "granularity", grain,
    body: { projectId: owner.tree.task_id, taskId, targetMinutes: Number(targetInput.value), level: { fine: "finer", steady: "standard", wide: "coarser" }[grain],
      reason: state.monitor?.reason || state.dayGrainSuggestion?.reason || "manual", ...(state.monitor?.taskId === taskId && state.monitor?.focusSessionId ? { focusSessionId: state.monitor.focusSessionId } : {}) },
  });
}

function paintGrainChoices(grain, resetTarget = true) {
  state.pendingGrain = grain;
  document.querySelectorAll("#grain-choices .grain-choice").forEach((button) => {
    button.classList.toggle("selected", button.dataset.grain === grain);
  });
  const detailKey = grain === "fine" ? "grainFineDetail" : grain === "wide" ? "grainWideDetail" : "grainSteadyDetail";
  const input = document.getElementById("grain-target-minutes");
  const option = GRAIN_OPTIONS[grain];
  input.min = String(option.min);
  input.max = String(option.max);
  if (resetTarget) input.value = String(grain === currentDayGrain() && state.appliedGrainTarget >= option.min && state.appliedGrainTarget <= option.max ? state.appliedGrainTarget : option.value);
  document.getElementById("grain-detail").textContent = t("targetRange", { min: option.min, max: option.max, detail: t(detailKey) });
}
function updateGrainSelection() {
  const taskId = document.getElementById("grain-target").value;
  document.getElementById("grain-apply").disabled = !taskId;
  const nodes = state.projects.flatMap((project) => walkNodes(project.tree));
  let target = nodes.find((node) => node.task_id === taskId);
  if (target?.status === "IN_PROGRESS" && target.parent_id) target = nodes.find((node) => node.task_id === target.parent_id) || target;
  const leaves = collectLeaves(target);
  const pending = leaves.filter((leaf) => ["PENDING", "BLOCKED"].includes(leaf.status));
  document.getElementById("grain-selection-summary").textContent = target ? t("selectedWork", { count: pending.length, minutes: Math.round(pending.reduce((sum, leaf) => sum + Number(leaf.estimated_time || 0) * 60, 0)), preserved: leaves.length - pending.length }) : "";
}

function openDayGrain() {
  if (!state.projects.length) return showToast(t("noAdjustableTask"));
  paintGrainChoices(currentDayGrain());
  const options = state.projects.flatMap((project) => {
    const unfinished = walkNodes(project.tree).filter((node) => node.task_id !== project.tree.task_id && (node.task_id === state.monitor?.taskId || collectLeaves(node).some((leaf) => !["DONE", "SKIPPED", "IN_PROGRESS"].includes(leaf.status))));
    return [{ node: project.tree, label: `${taskTitle(project.tree)} · ${t("allRemaining")}` },
      ...unfinished.map((node) => ({ node, label: `${taskTitle(project.tree)} / ${taskTitle(node)}` }))];
  });
  const target = document.getElementById("grain-target");
  target.innerHTML = `<option value="">${escapeHtml(t("chooseAdjustment"))}</option>` + options.map(({ node, label }) => `<option value="${escapeHtml(node.task_id)}">${escapeHtml(label)}</option>`).join("");
  const requested = state.monitor ? state.monitor.taskId : state.selectedSubtaskId || state.tree?.task_id;
  const selected = options.find(({ node }) => node.task_id === requested);
  target.value = selected ? requested : "";
  document.getElementById("grain-apply").disabled = !target.value;
  const reason = document.getElementById("grain-reason");
  const notes = [];
  if (state.monitor?.reason) notes.push(t("monitorReason", { reason: state.monitor.reason }));
  if (state.monitor?.taskId && !selected) notes.push(t("missingMonitorTask"));
  if (selected?.node.status === "IN_PROGRESS") notes.push(t("activeAdjustment"));
  reason.hidden = !notes.length;
  reason.textContent = notes.join(" · ");
  updateGrainSelection();
  document.getElementById("grain-modal").classList.add("open");
  target.focus();
}

function routineInvalid(hours, start, end, lunchStart, lunchEnd, dinnerStart, dinnerEnd) {
  if (!(hours >= 0.5 && hours <= 16)) return true;
  if ([start, end, lunchStart, lunchEnd, dinnerStart, dinnerEnd].some((value) => value == null)) return true;
  if (!(end > start) || !(lunchEnd > lunchStart) || !(dinnerEnd > dinnerStart)) return true;
  const meals = mealRanges([
    { start: lunchStart, end: lunchEnd },
    { start: dinnerStart, end: dinnerEnd },
  ]);
  return workableMinutes(start, end, meals) !== Math.round(hours * 60);
}
function fillCycleForm(prefix) {
  for (const [key, [suffix]] of Object.entries(CYCLE_FIELDS)) document.getElementById(`${prefix}-${suffix}`).value = String(state.cycle[key]);
}
function readCycleForm(prefix) {
  return Object.fromEntries(Object.entries(CYCLE_FIELDS).map(([key, [suffix]]) => [key, Number(document.getElementById(`${prefix}-${suffix}`).value)]));
}
function routineBody(hours, start, end, lunchStart, lunchEnd, dinnerStart, dinnerEnd, persona = state.persona) {
  return { workStart: clock(start), workEnd: clock(end), ...state.cycle, rest: state.rest || "", timezone: timezone(), date: ymd(startOfDay(new Date())),
    focusflow: { ...sharedDeskBody().focusflow, hoursPerDay: hours, periodStart: start, periodEnd: end,
      lunchStart, lunchEnd, dinnerStart, dinnerEnd, persona } };
}
async function saveSchedule(event) {
  event.preventDefault();
  const hours = Number(document.getElementById("hours-per-day").value);
  const values = ["period-start", "period-end", "lunch-start", "lunch-end", "dinner-start", "dinner-end"].map((id) => minutesFromClock(document.getElementById(id).value));
  if (routineInvalid(hours, ...values)) { refreshScheduleForms(false); focusInvalid(scheduleModal); return showToast(t("needSchedule")); }
  await generateDraft({ path: "/api/scheduler/routine/preview", kind: "routine", body: { ...routineBody(hours, ...values), ...readCycleForm("routine"), rest: document.getElementById("routine-rest").value.trim() || t("restAdvice") } });
}
async function saveEntry(event) {
  event.preventDefault();
  const hours = Number(document.getElementById("entry-hours").value);
  const values = ["entry-start", "entry-end", "entry-lunch-start", "entry-lunch-end", "entry-dinner-start", "entry-dinner-end"].map((id) => minutesFromClock(document.getElementById(id).value));
  if (routineInvalid(hours, ...values)) { refreshScheduleForms(false); focusInvalid(entryModal); return showToast(t("needSchedule")); }
  await generateDraft({ path: "/api/scheduler/routine/preview", kind: "routine", entry: true,
    body: { ...routineBody(hours, ...values, document.getElementById("entry-persona").value), ...readCycleForm("entry") } });
}
function trapDialogTab(event, dialog) {
  if (event.key !== "Tab" || !dialog.classList.contains("open")) return;
  const items = [...dialog.querySelectorAll("input, select, button, textarea")].filter((item) => !item.disabled && !item.hidden && item.getClientRects().length);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
document.getElementById("open-schedule").addEventListener("click", () => {
  fillScheduleForm();
  scheduleModal.classList.add("open");
  document.getElementById("period-start").focus();
});
document.getElementById("cancel-schedule").addEventListener("click", () => scheduleModal.classList.remove("open"));
scheduleModal.addEventListener("click", (event) => {
  if (event.target === scheduleModal) scheduleModal.classList.remove("open");
});
scheduleForm.addEventListener("submit", saveSchedule);
entryForm.addEventListener("submit", saveEntry);
document.addEventListener("keydown", (event) => {
  if (document.getElementById("draft-dialog").open) return;
  const overlay = document.getElementById("decompose-overlay");
  if (overlay.classList.contains("open")) { trapDialogTab(event, overlay); return; }
  trapDialogTab(event, modal);
  trapDialogTab(event, entryModal);
  trapDialogTab(event, scheduleModal);
  trapDialogTab(event, document.getElementById("focus-modal"));
  trapDialogTab(event, document.getElementById("grain-modal"));
  trapDialogTab(event, document.getElementById("grain-suggest-modal"));
});
document.getElementById("open-day-grain").addEventListener("click", openDayGrain);
document.getElementById("grain-cancel").addEventListener("click", () => {
  document.getElementById("grain-modal").classList.remove("open");
  state.monitor = null;
});
document.getElementById("grain-target").addEventListener("change", updateGrainSelection);
document.getElementById("grain-apply").addEventListener("click", () => applyDayGrain(state.pendingGrain || currentDayGrain()));
document.getElementById("grain-choices").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-grain]");
  if (!choice) return;
  paintGrainChoices(choice.dataset.grain);
});
document.getElementById("grain-modal").addEventListener("click", (event) => {
  if (event.target.id === "grain-modal") document.getElementById("grain-modal").classList.remove("open");
});
document.getElementById("grain-suggest-keep").addEventListener("click", dismissDayGrainSuggestion);
document.getElementById("grain-suggest-apply").addEventListener("click", () => {
  document.getElementById("grain-suggest-modal").classList.remove("open");
  openDayGrain();
  if (state.dayGrainSuggestion) paintGrainChoices(state.dayGrainSuggestion.direction);
});
document.getElementById("grain-suggest-modal").addEventListener("click", (event) => {
  if (event.target.id === "grain-suggest-modal") dismissDayGrainSuggestion();
});
document.getElementById("focus-keep").addEventListener("click", dismissFocusSuggestion);
document.getElementById("focus-apply").addEventListener("click", applyFocusSuggestion);
document.getElementById("focus-modal").addEventListener("click", (event) => {
  if (event.target.id === "focus-modal") dismissFocusSuggestion();
});
initForm.addEventListener("submit", initializePlan);
document.getElementById("generation-cancel").addEventListener("click", cancelGeneration);
document.getElementById("generation-retry").addEventListener("click", () => {
  if (state.previewRequest) void generateDraft(state.previewRequest);
});
document.getElementById("draft-commit").addEventListener("click", commitDraft);
document.getElementById("draft-cancel").addEventListener("click", () => void discardDraft());
document.getElementById("draft-dialog").addEventListener("cancel", (event) => { event.preventDefault(); void discardDraft(); });
document.getElementById("draft-regenerate").addEventListener("click", async () => {
  const request = state.draft?.context;
  await discardDraft(false);
  if (request) await generateDraft(request);
});

function setNav(nav) {
  if (!["tree", "day", "timeline", "calendar"].includes(nav)) return;
  state.nav = nav;
  document.querySelectorAll("[data-nav]").forEach((item) => item.classList.toggle("active", item.dataset.nav === nav));
  renderAll();
}

function shiftFocus(direction) {
  const focus = state.focus;
  if (state.nav === "calendar") {
    const next = new Date(focus.getFullYear(), focus.getMonth() + direction, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(focus.getDate(), last));
    state.focus = next;
  } else if (state.nav === "timeline") {
    state.focus = addDays(focus, 7 * direction);
  } else {
    state.focus = addDays(focus, direction);
  }
  renderAll();
}

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => setNav(button.dataset.nav));
});
document.getElementById("cal-prev").addEventListener("click", () => shiftFocus(-1));
document.getElementById("cal-next").addEventListener("click", () => shiftFocus(1));
document.getElementById("cal-today").addEventListener("click", () => {
  state.focus = startOfDay(new Date());
  renderAll();
});
document.getElementById("search").addEventListener("input", (event) => {
  state.search = event.target.value;
  state.searchDisclosure = {};
  renderBoard();
});
document.addEventListener("focusin", (event) => {
  if (event.target.closest("#board")) state.boardFocusId = event.target.id || null;
  else if (event.target !== document.body) state.boardFocusId = null;
});
document.getElementById("tree-expand-all").addEventListener("click", () => {
  setTreeExpanded(walkNodes(state.tree).filter(node => node.children?.length).map(node => node.task_id), true);
  renderBoard();
});
document.getElementById("tree-collapse-all").addEventListener("click", () => {
  setTreeExpanded(walkNodes(state.tree).filter(node => node.children?.length).map(node => node.task_id), false);
  renderBoard();
});
document.getElementById("board").addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-tree-toggle]");
  if (toggle) {
    const node = walkNodes(state.tree).find(item => item.task_id === toggle.dataset.treeToggle);
    if (node) setTreeExpanded([node.task_id], !treeExpanded(node));
    renderBoard();
    return;
  }
  const move = event.target.closest("[data-tree-move]");
  if (move) { void moveTreeNode(move.dataset.treeMove, Number(move.dataset.direction)); return; }
  const day = event.target.closest("[data-day]");
  if (day && !event.target.closest("[data-milestone-id]")) {
    state.focus = parseYmd(day.dataset.day);
    setNav("day");
    return;
  }
  const button = event.target.closest("[data-milestone-id]");
  if (!button) return;
  if (button.dataset.projectId) selectProject(button.dataset.projectId);
  state.selectedMilestoneId = button.dataset.milestoneId;
  state.selectedSubtaskId = button.dataset.subtaskId || null;
  setTreeExpanded([state.selectedMilestoneId, ...subtasksOf(selectedMilestone()).map(node => node.task_id)], true);
  setNav("tree");
  document.getElementById(treeId("toggle", state.selectedSubtaskId || state.selectedMilestoneId))?.focus();
});
document.getElementById("board").addEventListener("change", (event) => {
  const status = event.target.closest("select[data-status-task-id]");
  if (status) { void updateTaskStatus(status.dataset.statusTaskId, status.value); return; }
  const input = event.target.closest("input[data-task-id]");
  if (!input) return;
  handleTaskCheck(input);
});

function fillEntryForm() {
  fillCycleForm("entry");
  document.getElementById("persona").value = state.persona;
  document.getElementById("entry-persona").value = state.persona;
  document.getElementById("entry-lunch-start").value = clock(state.lunchStart);
  document.getElementById("entry-lunch-end").value = clock(state.lunchEnd);
  document.getElementById("entry-dinner-start").value = clock(state.dinnerStart);
  document.getElementById("entry-dinner-end").value = clock(state.dinnerEnd);
  document.getElementById("entry-hours").value = String(state.hoursPerDay);
  document.getElementById("entry-start").value = clock(state.periodStart);
  document.getElementById("entry-end").value = clock(state.periodEnd);
  entryPeriod.keepEnd();
  refreshScheduleForms(false);
}
void (async function startDesk() {
  loadSchedule();
  await pullSharedDesk();
  fillEntryForm();
  applyStaticCopy();
  renderAll();
  if (state.hasSharedRoutine) entryModal.classList.remove("open");
  else window.requestAnimationFrame(() => document.getElementById("entry-start").focus());
  const query = new URLSearchParams(window.location.search);
  if (query.get("taskId") || query.get("reason") || query.get("adjust") === "granularity") {
    state.monitor = { taskId: query.get("taskId"), reason: query.get("reason"), focusSessionId: query.get("focusSessionId") };
  }
  await fetchTree(false);
  connectWebSocket();
  if (state.monitor && !entryModal.classList.contains("open")) openDayGrain();
  state.ready = true;
})();
window.addEventListener("focus", () => {
  if (!state.ready || state.inflight || state.committing) return;
  void (async () => { await pullSharedDesk(); await fetchTree(false); })();
});
