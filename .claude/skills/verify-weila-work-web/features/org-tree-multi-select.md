# Org tree department multi-select

## Sub-features

- The add-member pickers on the group detail page (`添加群成员`) and the department detail page (`添加成员`) render `OrgTree` in multi mode.
- Each department row has a tri-state checkbox. Checking an unloaded department loads and expands it, then selects every selectable member.
- Each member row keeps one `<button>` with a visible check indicator and `aria-pressed` in multi mode.
- Solo mode (`user-track`, chat session picker) renders no department checkbox and no `aria-pressed`.
- `GroupSettings` renders `OrgTreeMemberItem` without `showCheckbox`, so its rows stay buttons.

## How to get to it (user POV)

Login, open 群组管理, click the zero-member group 验证群02 (id 80001120), then 添加群成员. For the department modal, open 部门管理, click cw (id 67), then 添加成员.

## Driving it with agent-browser

Open the group modal:

```bash
agent-browser --session verify open "$BASE/#/contact/group-80001120-%E9%AA%8C%E8%AF%81%E7%BE%A402" --ignore-https-errors
sleep 5
agent-browser --session verify find role button click --name "添加群成员"
sleep 2
```

Check the first department. Let `N` be the enabled member row count.

```bash
agent-browser --session verify get count '.org-tree__dept:nth-of-type(1) .org-tree-member-item:not(.org-tree-member-item--disabled)'
agent-browser --session verify click '.org-tree__dept:nth-of-type(1) .arco-checkbox'
sleep 1
agent-browser --session verify get attr '.org-tree__dept:nth-of-type(1) .arco-checkbox' class
# arco-checkbox-checked
agent-browser --session verify get count '.org-tree-member-item[aria-pressed="true"]'
# N
```

Partial, partial to all, all to none:

```bash
agent-browser --session verify click '.org-tree__dept:nth-of-type(1) .org-tree-member-item:nth-of-type(1)'
agent-browser --session verify get attr '.org-tree__dept:nth-of-type(1) .arco-checkbox' class
# arco-checkbox-indeterminate
agent-browser --session verify click '.org-tree__dept:nth-of-type(1) .arco-checkbox'
agent-browser --session verify click '.org-tree__dept:nth-of-type(1) .arco-checkbox'
```

Load a collapsed department on check. Read the current department shape first.

```bash
agent-browser --session verify scrollintoview '.org-tree__dept:nth-of-type(2) .arco-checkbox'
agent-browser --session verify click '.org-tree__dept:nth-of-type(2) .arco-checkbox'
sleep 2
agent-browser --session verify get attr '.org-tree__dept:nth-of-type(2) .org-tree__dept-button' aria-expanded
# true
agent-browser --session verify get attr '.org-tree__dept:nth-of-type(2) .arco-checkbox' class
# arco-checkbox-checked when the department has selectable members
# arco-checkbox-disabled when the department is empty
agent-browser --session verify get count '.org-tree__dept:nth-of-type(2) .org-tree-member-item:not(.org-tree-member-item--disabled)'
# M, the number of selectable members the department actually returned
```

The current seed data has cw empty, so the expected branch is `arco-checkbox-disabled` with 0 rows. To run the non-empty branch, use a department that still has selectable members and check it while collapsed.

Submit and capture the payload. Check the first department, then uncheck members until 2 remain, so the payload is small and still proves the department materialization.

```bash
agent-browser --session verify get count '.org-tree-member-item[aria-pressed="true"]'
agent-browser --session verify network har start /tmp/add-members.har
agent-browser --session verify click '.arco-modal-footer .arco-btn-primary'
sleep 3
agent-browser --session verify network har stop /tmp/add-members.har
jq -r '.log.entries[] | select(.request.url | contains("add-group-members")) | .request.postData.text' /tmp/add-members.har
```

Pass: the body is `{ group_id, user_ids }` with exactly the 2 user ids still selected.

Reopen and assert the added members are disabled. The first department is already expanded, so do not click its header; that would collapse it.

```bash
agent-browser --session verify find role button click --name "添加群成员"
sleep 2
agent-browser --session verify scrollintoview '.org-tree__dept:nth-of-type(1) .org-tree-member-item--disabled'
agent-browser --session verify get count '.org-tree__dept:nth-of-type(1) .org-tree-member-item--disabled'
# at least 2, including the submitted ids
```

If every member of that department is now in the group, its checkbox must be `arco-checkbox-disabled`. Otherwise it stays enabled and unchecked.

Cleanup: close the modal, select each added row, close the edit modal, click 删除, then 提交. Confirm the group shows 暂无数据.

Solo and shared-row regressions:

```bash
agent-browser --session verify open "$BASE/#/workbench/user-track" --ignore-https-errors
sleep 10
agent-browser --session verify get count '.org-tree__dept-row .arco-checkbox'
# 0
agent-browser --session verify get count '.org-tree-member-item__check'
# 0
agent-browser --session verify get attr '.org-tree-member-item' aria-pressed
# no value
```

For `GroupSettings`, open a group chat, click 群组设置, then `get count 'button.org-tree-member-item'` equals the member rows and `get count '.org-tree-member-item__check'` is 0.

Keyboard: focus `.org-tree__dept:nth-of-type(1) .arco-checkbox input`, press Space, and expect the department to become checked. Focus a member row button and press Space to toggle that row.

## Gotchas

- The corp has two departments, 测试企业 and cw. The group detail test group 验证群02 must start with 0 members and be left at 0.
- Member and department counts drift as people move between departments. Derive every expected count from the DOM or the network response instead of hard-coding it.
- The department modal's target department has its own members disabled. Use it for the disabled and empty states, not for a submit unless membership can be restored.
- The member row is a button with `aria-pressed`, not a native checkbox. Query `aria-pressed`, not `:checked`.
- An unexpanded department is `unloaded`: its checkbox is enabled and a click loads it. A department whose members are all disabled becomes `empty` and its checkbox is disabled.
- The first transform of a heavy workbench page can leave it blank. Reload once and wait 10 seconds before calling it a break.
- The modal body is a scroll container. Use `scrollintoview` before clicking a control near the bottom; otherwise the fixed footer intercepts the click.
- The first department is auto-expanded on open. Do not click its header before counting its rows; that collapses it.
