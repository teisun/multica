# Multica + Tomcat：三角色配置与计划交接

```text
用户 → 真正的 Mika（小队 leader）→ planner（Plan + 自动评审）
                                      │
                     Multica 任务：计划附件 + 评审摘要
                                      │
                               用户明确批准
                                      ↓
                         coder（Chat）读取原计划
                         start_plan(plan_id)
                                      │
                    update_plan 更新同一文件；实际测试
                                      ↓
                     Mika 在任务活动/收件箱向用户汇报

开发期间：用户问 Mika → 读原计划和运行消息 → 汇报当前进度
人工问题：同 HOME、同项目 VS Code 旁观窗口 → 回答当前问题
```

本文是配置和协作模板，不是验收通过声明。Multica 复用现有高级设置的「自定义参数」、小队、评论、附件和交付唤醒；不新增产品表单、审批数据库或进度轮询器。

## 1. 四个参数，各管一件事

在创建/编辑 Tomcat 智能体的高级设置中，**每行填一个参数，使用 `=`**。例如：

```text
--mode=plan
--plan-review=auto
--question-policy=recommended
```

CLI/API 中同样内容放在现有 `custom_args` 字符串数组中：

```json
["--mode=plan", "--plan-review=auto", "--question-policy=recommended"]
```

| 参数 | 值 | 默认与边界 |
| --- | --- | --- |
| `--mode` | `chat` / `plan` | 新会话默认 Chat；省略时载入保留已有模式。显式值在每次 new/load 应用 |
| `--plan-review` | `ask` / `auto` / `skip` | 默认 ask；只控制保存计划后的独立评审 |
| `--question-policy` | `manual` / `recommended` | 默认 manual；recommended 只自动回答普通业务问题 |
| `--plan-start` | `ask` / `auto` | 默认 ask；只决定 Plan 模式明确开工时是否再询问一次 |

**升级提醒：**以前没有填写任何自定义参数的 Tomcat 智能体，升级后普通模型提问默认会停下来，等待你在同 HOME、同项目的 VS Code 会话中回答。无人值守的智能体需要显式添加 `--question-policy=recommended`；这不会代替开发批准或工具授权。

- `auto` 评审会产生额外模型用量，结果只是建议；不意味着用户已经批准开发。
- `recommended` 按每题唯一推荐项的 ID 作答，记录 `answer_source: "policy_recommended"`；不冒充人工点击，不代答评审或开工确认。
- `--plan-start=auto` 不是「保存后自动开发」。任务仍须明确要求实施，智能体才调用 `start_plan`；工具权限照旧。
- 模式与三项策略通过标准 ACP `configOptions` 暴露。策略属于当前控制连接，不写入计划；重绑取新连接的启动值或默认值。不承诺忙碌会话随时热切换。
- 不使用 `TOMCAT_ACP_MODE` 等新增环境变量，也不在 Go adapter 中翻译参数。旧后台不能确认启动配置时，新 CLI 明确失败，不静默丢参数、不自行重启共享服务。

## 2. 三角色配置

| 角色 | 自定义参数 | 分工 |
| --- | --- | --- |
| 真正的 Mika | `--mode=chat`、`--question-policy=recommended` | 小队 leader；派计划、等待人类批准、派开发、回答进度、最终汇报 |
| 研发计划撰写小天才 | `--mode=plan`、`--plan-review=auto`、`--question-policy=recommended` | 只规划、保存结构化 PlanFile、等待评审、上传附件并交付 |
| 全栈攻城狮 | `--mode=chat` | 读取已批准计划，按 plan_id 开工，推进原文件并测试；普通问题默认在 VS Code 人工作答 |

Mika 和 planner 的示例显式采用 recommended；开发智能体默认只填 `--mode=chat`，保留人工选择。开发无人值守时可加 `--question-policy=recommended`。需要用户实际选业务方案的其它角色，可改为 `--question-policy=manual`。配置在新的连接/任务中生效，答题入口见第 6 节。

### Mika 补充 instructions

保留产品内置 Mika 的身份和系统指令，只在现有自定义 instructions 中补充：

```text
你是本小队的协调者，不代替 planner 写方案或代替 coder 编码。
需要方案时，按当前 Squad Roster 的真实 UUID mention 派给计划成员；一条派单评论后按平台要求记录 squad activity 并结束本轮，不循环等待。
计划成员交付后，向用户说明计划附件、原文件路径、plan_id、评审结果与尚未验证的事项。没有用户明确批准实施，只保持等待，不派编码任务；用户说“看看进度”不是开工批准。
收到修改意见只重新委派 planner 修订并重新上传，等待用户批准最后一次交付；收到批准后，把该次计划的 plan_id 和本机路径交给开发成员，明确要求实施，不复制、重建或悄悄改选另一份计划。
用户问进度时，读取这份 PlanFile 的 todos/evidence，并结合当前 issue runs / run-messages 报告正在做什么、已验证什么、有什么阻塞；不凭最后一条聊天猜完成，不高频轮询或发伪心跳。
Tomcat 成员等待 manual ask_question 时，指导用户在同机、同 HOME、同项目的 VS Code Tomcat 会话列表中打开对应外部会话并作答。Multica 只显示工具等待，不提供这张答题卡；不要让用户去 Multica 任务页找卡片，也不要代答。
开发成员交付后，在原任务活动中 mention 人类，报告改动、测试结果、失败或未验证项及计划状态，按现有小队职责置为 in_review，done 留给用户；沿用收件箱通知，不承诺自动回写最初的私聊窗口。
遵守平台的单轮评论和 no_action 规则；没有新动作时只记录 activity，不互相发送“收到”制造唤醒循环。
```

### planner instructions

```text
你负责研发计划，不负责实施。先从第一性原理澄清目标、必要安全边界和现有完整工作流；允许推翻不合理设计，但只补当前缺失能力，避免过度设计。
使用 Tomcat write-plans 工作流和 create_plan 保存完整结构化计划，包含清晰的研发步骤、定向测试和最终验收。不要只在任务评论里写散文方案。
等待 create_plan 返回独立评审结果，如实区分评审完成、跳过、不可用或失败。评审是建议，不等于人工批准实施。
用当前 Multica 任务的正常交付评论上传已保存的计划，提供原文件路径、plan_id、评审摘要和待确认事项，然后结束。附件只是查看用快照，开发交接仍使用同 HOME 下原 PlanFile。
只执行宿主分配的任务读取、上传已保存计划、交付评论等必要命令；不写项目实现、不安装软件、不提交或发布，不调用 start_plan 开工。
```

### coder instructions

```text
只实施 Mika 明确交接且已获用户批准的计划。收到本机路径时先读取标准 PlanFile，取得其中的 plan_id；检查目标和任务相符，再调用 start_plan(plan_id)。不要 create_plan 重建一份，不直接编辑计划机器字段。
从第一性原理选择架构和代码实现：先找现有完整工作流，复用责任归属和安全边界，只增加当前缺失能力。发现方案有实质问题要说明，不盲目实现，也不扩展成平台。
用 update_plan 先领取工作，完成后立即附具体证据更新同一文件；遇到阻塞如实记录。执行中工作描述冻结，不能靠改描述制造完成。
按项目自己的命令做定向检查；最终按 verify 技能检查 diff 与影响范围。通过构建不等于 UI 验收，未运行不能写成通过。
结束时在当前 Multica 任务按既有交付要求发一次正常交付评论，列出原计划路径/ID、实际改动、测试与未验证项，让小队 leader 接续汇报；不要另开平行任务或直接用 /note 代替需要唤醒的交付。
```

### 小队 instructions

```text
阶段顺序：规划和独立评审 → 人类明确批准 → 原计划交接开发 → 实际验证 → Mika 汇报。
Mika 是 leader；规划和开发分派给 roster 中对应成员。使用平台提供的完整 UUID mention 链接，不只写 @显示名。
普通进度更新不自动派下一阶段。只有明确的人类实施批准才派开发；reviewer 的建议和自动推荐答案都不是批准。
依赖正常评论、附件、squad activity 和成员交付唤醒，不增加状态表、轮询器、重复确认票据或双方互相 @ 的确认循环。
```

## 3. 可复制的 CLI/API 配置顺序

以下为 **Bash 示例，从 Multica 仓库根目录执行**。先用已有开发环境脚本准备独立环境、登录、注册 Tomcat runtime，再配置角色。不要修改既有智能体来做验收。

先确定这些值，不能照抄别人的 UUID：

| 值 | 来源 |
| --- | --- |
| `PROFILE` | 本次 `make up` 输出的专用 profile，或你明确选择的已登录 profile |
| `WORKSPACE_ID` | 同 profile 的 `workspace list` JSON 中目标工作区 ID |
| `RUNTIME_ID` | 同工作区 `runtime list` 中在线的 Tomcat runtime ID；核对对应 daemon |
| `MODEL` | 该测试 HOME 的 Tomcat `model list` 中已配置的模型；隔离验收使用 DeepSeek |
| `DAEMON_ID` | 所选 `runtime list` JSON 的 `daemon_id`；再用 `daemon status` 核对 profile/PID。本地资源必须由它可访问 |
| `PROJECT_PATH` | 本次可丢弃 Git 仓库的绝对路径，不是正式项目或另一个 worktree |

同机的不同 profile 会共享 `daemon_id`（见 `server/internal/daemon/identity.go`），它不是隔离环境编号。必须同时核对所选 profile 的 PID、health 返回的 `server_url`、进程实际连接的后端和 `MULTICA_TOMCAT_PATH`；不能仅凭 ID 判断归属，也不要为让 ID 不同而改写机器身份。

```bash
MC="$PWD/server/bin/multica"
: "${PROFILE:?先选择专用 profile}"
mc() { "$MC" --profile "$PROFILE" "$@"; }
mc workspace list --output json
# 从上面的结果设置并 export WORKSPACE_ID
: "${WORKSPACE_ID:?先选择工作区 UUID}"
mc() { "$MC" --profile "$PROFILE" --workspace-id "$WORKSPACE_ID" "$@"; }
mc runtime list --output json
mc daemon status
# 从实际结果设置并 export RUNTIME_ID、DAEMON_ID、MODEL、PROJECT_PATH
: "${RUNTIME_ID:?先选择在线 Tomcat runtime}"
: "${MODEL:?先选择已配置模型}"
umask 077
SETUP_DIR="$(mktemp -d)"
json_id() { node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const x=JSON.parse(s);if(!x.id)throw Error("missing id");process.stdout.write(x.id)})'; }
```

把第 2 节四段 instructions 原文分别保存为 `$SETUP_DIR/mika.txt`、`planner.txt`、`coder.txt`、`squad.txt`。这些是配置输入，不包含模型密钥。

### 3.1 创建真正的 Mika，再配置三角色

**不要**用 `agent create --name Mika` 冒充产品 Mika，也不要写数据库的 `system_key`。现有正式入口为 `POST /api/agents/mika`，返回 agent 和当前用户的 onboarding session；已有 Mika 时复用，不悄悄改绑 runtime。

下面仅在内存中读取**本次所选 profile** 的登录 token，不打印它。示例使用标准 `~/.multica/profiles/<profile>/config.json`；使用自定义配置根时，应传入该 profile 的实际 `PROFILE_CONFIG`，不要转而读取其它账号的配置。

```bash
export PROFILE_CONFIG="${PROFILE_CONFIG:-$HOME/.multica/profiles/$PROFILE/config.json}"
export WORKSPACE_ID RUNTIME_ID MODEL
MIKA_ID="$(node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync(process.env.PROFILE_CONFIG, 'utf8'));
if (!c.token || !c.server_url || (c.workspace_id && c.workspace_id !== process.env.WORKSPACE_ID)) {
  throw new Error('Login/profile/workspace mismatch; do not borrow another profile');
}
const url = new URL('/api/agents/mika', c.server_url);
if (url.protocol === 'ws:') url.protocol = 'http:';
if (url.protocol === 'wss:') url.protocol = 'https:';
const response = await fetch(url, {
  method: 'POST',
  headers: {'Content-Type':'application/json', Authorization:`Bearer ${c.token}`, 'X-Workspace-ID':process.env.WORKSPACE_ID},
  body: JSON.stringify({runtime_id:process.env.RUNTIME_ID, language:'zh', model:process.env.MODEL}),
});
if (!response.ok) throw new Error(`Create Mika failed: ${response.status}`);
const result = await response.json();
if (!result.id) throw new Error('Mika response has no id');
process.stdout.write(result.id);
NODE
)"
mc agent get "$MIKA_ID" --output json
# 确认 genuine Mika 的 runtime 是目标 Tomcat；已有绑定不符时先经正常设置处理。
mc agent update "$MIKA_ID" --model "$MODEL" --max-concurrent-tasks 3 \
  --custom-args '["--mode=chat","--question-policy=recommended"]' \
  --instructions "$(cat "$SETUP_DIR/mika.txt")"
PLANNER_ID="$(mc agent create --name '研发计划撰写小天才' --runtime-id "$RUNTIME_ID" \
  --model "$MODEL" --permission-mode public_to --public-to-workspace --max-concurrent-tasks 1 \
  --custom-args '["--mode=plan","--plan-review=auto","--question-policy=recommended"]' \
  --instructions "$(cat "$SETUP_DIR/planner.txt")" | json_id)"
CODER_ID="$(mc agent create --name '全栈攻城狮' --runtime-id "$RUNTIME_ID" \
  --model "$MODEL" --permission-mode public_to --public-to-workspace --max-concurrent-tasks 1 \
  --custom-args '["--mode=chat"]' \
  --instructions "$(cat "$SETUP_DIR/coder.txt")" | json_id)"
SQUAD_ID="$(mc squad create --name '计划研发协作小队' --leader "$MIKA_ID" | json_id)"
mc squad member add "$SQUAD_ID" --member-id "$PLANNER_ID" --type agent
mc squad member add "$SQUAD_ID" --member-id "$CODER_ID" --type agent
mc squad update "$SQUAD_ID" --instructions "$(cat "$SETUP_DIR/squad.txt")"
mc squad get "$SQUAD_ID" --output json
```

示例成员设置为本工作区可调用，不公开到其它工作区。正式使用时按所需权限调整；不能靠改显示名获得 Mika 身份。保存实际 ID、runtime 绑定和并发容量，不能把配置保存成功当作任务已跑通。

### 3.2 关联同一项目，再派给小队

```bash
: "${DAEMON_ID:?读取所选 runtime 的 daemon_id，并核对 profile/PID}"
: "${PROJECT_PATH:?使用本次临时 Git 仓库的绝对路径}"
PROJECT_ID="$(mc project create --title '计划协作验收' | json_id)"
mc project resource add "$PROJECT_ID" --type local_directory \
  --daemon-id "$DAEMON_ID" --local-path "$PROJECT_PATH" --execution-mode in_place
ISSUE_ID="$(mc issue create --title '先规划、批准后实施' --project "$PROJECT_ID" \
  --assignee-id "$SQUAD_ID" \
  --description '在本次可丢弃仓库实现约定的小功能和测试。先让 planner 规划并交付计划附件、plan_id、原路径及评审摘要；等待我明确批准，再由 coder 按原计划实施。Mika 负责协调和最终汇报，不自行编码。' | json_id)"
mc issue get "$ISSUE_ID" --output json
```

验收时把「约定的小功能」替换成可客观检查的需求，不要让测试靠模型猜题。使用 `in_place` 可让三角色及 VS Code 看到同一个实际路径；该资源会串行化占用它的运行。开发期间的 Mika 进度询问宜走它的独立 Chat，避免被同一项目资源锁排队误认为服务失去响应。

## 4. 实际交付、批准与交接

1. Mika 用 roster 里提供的完整链接派单，例如 `[@研发计划撰写小天才](mention://agent/<真实 PLANNER_ID>)`；不能只写 `@名字`。
2. planner 用 `create_plan` 保存并等评审返回，再在当前任务按平台要求上传**原计划文件**。文件在项目目录外时，现有 CLI 上传须显式 `--allow-external-file`。正文包括原路径、plan_id、评审摘要和未验证项。
3. 用户在 Multica 打开附件及评审，在同任务明确评论「批准实施这份计划」。评审失败/跳过也要让用户看见，不能冒充已评审。
4. Mika 交给 coder 的任务须明确「实施此 plan_id」，并附原路径。coder 读取后调用 `start_plan(plan_id)`，更新同一个 PlanFile，不从附件下载后另起副本。
5. coder 正常交付，Mika 按既有小队唤醒机制汇报。报告测试的实际结果和未验证项，不把 todo 勾选、构建成功或 reviewer 建议当验收通过。

成员上传的现有命令示例（在其宿主任务环境中执行，不借管理员 profile/token）：

```bash
# ISSUE_ID / TRIGGER_COMMENT_ID 取自当前任务及触发评论。
# PLAN_ID / REVIEW_SUMMARY 取自 create_plan 的实际返回，不能填写“通过”占位。
: "${ISSUE_ID:?当前任务 UUID}"
: "${TRIGGER_COMMENT_ID:?当前触发评论 UUID}"
: "${PLAN_ID:?本次保存的 plan_id}"
: "${REVIEW_SUMMARY:?实际评审结果}"
PLAN_PATH="$HOME/.tomcat/plans/$PLAN_ID.plan.md"
multica issue comment add "$ISSUE_ID" --parent "$TRIGGER_COMMENT_ID" \
  --attachment "$PLAN_PATH" --allow-external-file \
  --content "计划：$PLAN_ID；原文件：$PLAN_PATH；评审：$REVIEW_SUMMARY。请审阅，尚未实施。"
```

评论触发的成员运行必须带正确的 `--parent`；直接分配、没有触发评论时省略它，不凭空造父评论。人类批准应回复 Mika 的负责人线程或 mention 小队。CLI 对照命令如下，正式桌面验收仍需实际在桌面发表评论：

```bash
# MIKA_THREAD_ID 来自原任务中 Mika 的负责人评论，不是随意取最后一条评论。
mc issue comment add "$ISSUE_ID" --parent "$MIKA_THREAD_ID" \
  --content '批准实施本线程最后交付的计划，请 Mika 交给开发成员。'
```

标准 plans 目录内的文件路径也支持：**智能体先读文件取 plan_id**，不是给 start_plan 新加路径参数。仅限同机、同 HOME、默认 `~/.tomcat/plans/` 中的合法 Tomcat 结构化计划；普通 Markdown、其它机器或另一 HOME 不在本契约内。附件是查看快照，后续原文件修改不会自动重写历史附件。

进度查询使用原工具和事实源：

```bash
mc issue runs "$ISSUE_ID" --active --output json
# RUN_ID 取自上面真实结果；读取一批消息，不加轮询器。
mc issue run-messages "$RUN_ID" --output json
```

计划进度读原文件的 todos/evidence；run 状态读平台记录，两者回答不同问题。只需信息时遵守平台现有 no_action/activity 规则，避免回复引发的空转循环；`/note` 仅用于明确不唤醒的记录，不替代阶段交付。

## 5. 一体化智能体：同一任务内规划并实施

```json
["--mode=plan", "--plan-review=auto", "--question-policy=recommended", "--plan-start=auto"]
```

任务必须明确写「规划、独立评审后实施此功能并验证」。它在同一回合内 create_plan → review → start_plan → Chat 编码，工具权限不变；如果只要求写计划，就应停在计划交付。

已知边界：后续任务再次 new/load 时，显式 `--mode=plan` 会重新进入 Plan，不能承诺跨任务自动保持编码状态。本轮不为此增加新的续接机制。

## 6. 人工问题与并发准备

```text
manual 问题等待 → 打开同 HOME / 同项目 VS Code → 选外部会话 → 提交答案
窗口晚打开/重连 → 补发仍等待的问题
一个窗口已答   → 其余撤卡；只有服务端采用结果算数
关闭旁观窗口   → 不取消 Multica 任务
```

旁观窗口可回答当前问题，不能主动发任务、停止、build 或批准工具权限。单题跳过仍可提交；旁观者不能取消整个问题。ACP 冷载入只回放，下一次明确输入才开跑。

提问自身没有 deadline，但 Multica run 仍受任务 Timeout 和 daemon 的 idle/tool watchdog 约束（默认 2 小时）；超时按宿主取消，不转成推荐答案。没有 VS Code 时，Mika 应说明等待人工打开窗口，不能伪报模型仍在编码。

开发期间要同时回答进度：先记录 Mika、成员和 daemon 的实际并发容量，确保至少能容纳开发与协调两个运行；Mika 还可能有 leader 与独立 Chat 两个入口。不要把升级二进制的 `runtime update` 命令当成容量设置；采用现有 daemon/智能体设置。不要为验收人为设置真实模型的 token 上限。

## 7. 环境和验证边界

- 开发验证使用独立 HOME、明确的 Tomcat 开发二进制/启动器、专用 Multica profile/数据库/worktree、临时仓库和测试 agents/issues；不复制其它模型凭据，不动 TOMC-1/2 或既有智能体。
- macOS 本地 socket 有路径长度限制，测试 HOME 使用短物理路径；证据目录可保留链接，不修改产品路径机制来迁就夹具。
- 新 CLI 配旧后台出现启动配置不支持时，需要用户在合适时机通过既有入口更新/重启共享服务。Agent 不替用户安装或重启；磁盘构建成功不等于后台已更新。
- 无人值守批准仅用于明确可丢弃的验收仓库，并通过正常 UI/合法人类 API；不能把它扩展为正式项目自动授权。
- 单测、真实 IPC/ACP 集成和真实桌面旅程分别证明不同层级。实际验收还应关联 issue/run/session ID，保存并读回 PNG、ARIA snapshot、浏览器 console 和服务端结果；网页 200、DOM 测试或一张组件截图不能替代 Electron/VS Code 真实旅程。

## 8. 验证入口（不是已通过清单）

`TOMCAT_CHECKOUT` 是本机 Tomcat 仓库绝对路径；`NEW_TOMCAT_BIN` 取该次构建的真实产物路径，遵守 `CARGO_TARGET_DIR`。需要的 cargo-nextest/rg 按项目现有方式放到测试工具目录，仅给测试子进程加 PATH，不安装到用户入口。

```bash
# 从 Multica 根目录执行；只检查允许的测试改动。
unformatted="$(gofmt -l server/pkg/agent/tomcat_integration_test.go)" && test -z "$unformatted"
(cd server && go vet -tags=agentintegration ./pkg/agent)
(cd server && MULTICA_RUN_REAL_AGENT_SMOKE=1 MULTICA_TOMCAT_TEST_BIN="$NEW_TOMCAT_BIN" \
  go test -tags=agentintegration ./pkg/agent -run '^TestTomcat' -count=1 -timeout=5m)
git diff --check

# 从 Tomcat 仓库执行；gate-fast 按仓库脚本准备，不能用旧 CI 结果代替。
(cd "$TOMCAT_CHECKOUT/tomcat" && cargo build --locked --bin tomcat && \
  bash scripts/run-integration-tests.sh gate-fast)
(cd "$TOMCAT_CHECKOUT/tomcat-vscode-ext" && npm run gate:fast && \
  npm run test:integration -- tests/external_session_observation.test.ts tests/webview_provider_flow.test.ts && \
  npm run gen:wire)
```

还要检查 wire 生成物无差异，以及新文档自身的链接、JSON 与 Bash 示例；两仓原有脏文件不能混入本需求。受控协议测试使用本地模型 fixture，不证明真实模型已调用。

真实平台验收另跑：DeepSeek READY 冒烟；桌面配置保存并重开回读；未批准不开发、修改后重新交付、批准后按原 plan_id 开工；开发途中 Mika 私聊进度；Plan/Chat 的人工非推荐选择与自动推荐产物；最终汇报/收件箱。真实 VS Code 旅程沿用外部旁观 fixture 入口，不用答复 API 冒充点击。每次尝试保留独立证据，失败分类为代码、既有问题或环境问题，不拼接成虚假的一次成功。

实现说明位于 Tomcat 仓库：`tomcat/docs/architecture/shared-serve-and-acp-host-integration.md`、`tomcat/docs/architecture/tools/create-plan.md`、`tomcat/docs/architecture/tools/update-plan.md`、`tomcat/docs/architecture/tools/ask-question.md`。
