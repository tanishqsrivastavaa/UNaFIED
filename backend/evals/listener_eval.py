"""
Labelled conversations for the Listener. Calls the real model, so it costs one
request per case. Run from backend/:  uv run python -m evals.listener_eval
"""

import asyncio
from datetime import datetime, timedelta
from app.agents.listener_agent import Line, Plan, decide

NOW = datetime(2026, 10, 1, 10, 30)  # a Thursday
ZONE = "Asia/Kolkata"

COFFEE = Plan("Coffee", datetime(2026, 10, 1, 16, 0), "sam", agreed=False)
CALL = Plan("Project call", datetime(2026, 10, 2, 10, 0), "manish", agreed=True)
DINNER = Plan("Dinner", datetime(2026, 10, 2, 20, 0), "manish", agreed=False)
MOM = Plan("Call mom", datetime(2026, 10, 1, 18, 0), "sam", agreed=True, personal=True)
LUNCH = Plan("Lunch", datetime(2026, 10, 1, 13, 0), "sam", agreed=True)  # a group plan manish said yes to

ASK_COFFEE = ("sam", "coffee at 4 today?")
ASK_CALL = [("manish", "call tomorrow at 10 about the project?"), ("sam", "yes works")]
ASK_DINNER = ("manish", "dinner tomorrow at 8?")
ASK_MOM = ("sam", "remind me to call mom at 6")
ASK_LUNCH = [("sam", "lunch at 1 today?"), ("manish", "I'm in")]

# (plans, messages oldest first, expected). Expected is (action,), (action, plan),
# (action, "YYYY-MM-DD HH:MM") or (action, plan, "YYYY-MM-DD HH:MM").
CASES = [
    # New plans
    ([], [("sam", "hey lets meet at 4 pm today")], ("propose", "2026-10-01 16:00")),
    ([], [("manish", "call tomorrow at 10?")], ("propose", "2026-10-02 10:00")),
    ([], [("sam", "lunch at noon?")], ("propose", "2026-10-01 12:00")),
    ([], [("manish", "how about dinner tonight")], ("propose", "2026-10-01 20:00")),
    ([], [("sam", "want to grab coffee tomorrow morning?")], ("propose", "2026-10-02 09:00")),
    ([], [("manish", "let's do the review on Monday at 3pm")], ("propose", "2026-10-05 15:00")),
    ([], [("sam", "gym at 7am tomorrow?")], ("propose", "2026-10-02 07:00")),
    ([], [("manish", "can we talk at 9:30")], ("propose", "2026-10-02 09:30")),
    ([], [("sam", "meet me at the station in 2 hours")], ("propose", "2026-10-01 12:30")),
    ([], [("manish", "Saturday 6pm movie?")], ("propose", "2026-10-03 18:00")),
    ([], [("sam", "let's sync at 2:15 pm")], ("propose", "2026-10-01 14:15")),
    ([], [("manish", "morning!"), ("sam", "hey, how's it going"), ("manish", "Hey lets meet at 4 pm today.")], ("propose", "2026-10-01 16:00")),
    ([], [("sam", "should we meet this evening?")], ("propose", "2026-10-01 18:00")),
    ([], [("manish", "kal shaam 5 baje milte hain?")], ("propose", "2026-10-02 17:00")),
    # Not plans
    ([], [("sam", "how was your day?")], ("none",)),
    ([], [("manish", "we met at 4 yesterday, it was fun")], ("none",)),
    ([], [("sam", "we should hang out sometime")], ("none",)),
    ([], [("manish", "let's meet Friday")], ("none",)),
    ([], [("sam", "I'll be busy till 5 today")], ("none",)),
    ([], [("manish", "the store closes at 9 pm")], ("none",)),
    ([], [("sam", "lol that's hilarious")], ("none",)),
    ([], [("manish", "@unafied what's the capital of France?")], ("none",)),
    ([COFFEE], [ASK_COFFEE, ("sam", "so yeah coffee at 4!")], ("none",)),
    ([], [("sam", "remember when we had coffee at 4 last week?")], ("none",)),
    ([], [("manish", "my flight lands at 6 tomorrow")], ("none",)),
    ([], [("sam", "talk later")], ("none",)),
    # Agreeing to someone else's plan
    ([COFFEE], [ASK_COFFEE, ("manish", "sure, see you then")], ("agree", 1)),
    ([COFFEE], [ASK_COFFEE, ("manish", "sounds good 👍")], ("agree", 1)),
    ([COFFEE], [ASK_COFFEE, ("manish", "yes 4 works for me")], ("agree", 1)),
    ([COFFEE], [ASK_COFFEE, ("manish", "ok")], ("agree", 1)),
    ([COFFEE], [ASK_COFFEE, ("manish", "perfect, coffee at 4 it is")], ("agree", 1)),
    ([COFFEE, CALL], [*ASK_CALL, ASK_COFFEE, ("manish", "yep see you at 4")], ("agree", 1)),
    ([COFFEE, DINNER], [ASK_DINNER, ASK_COFFEE, ("sam", "dinner tomorrow works!")], ("agree", 2)),
    # Changing a plan
    ([COFFEE], [ASK_COFFEE, ("manish", "can we make it 5 instead?")], ("change", 1, "2026-10-01 17:00")),
    ([CALL], [*ASK_CALL, ("sam", "can we push the call to 11?")], ("change", 1, "2026-10-02 11:00")),
    ([COFFEE], [ASK_COFFEE, ("manish", "how about tomorrow same time?")], ("change", 1, "2026-10-02 16:00")),
    ([COFFEE], [ASK_COFFEE, ("sam", "actually let's do 4:30")], ("change", 1, "2026-10-01 16:30")),
    ([CALL], [*ASK_CALL, ("manish", "let's move the call to Monday 10am")], ("change", 1, "2026-10-05 10:00")),
    # Calling it off
    ([COFFEE], [ASK_COFFEE, ("manish", "sorry, can't make it today")], ("cancel", 1)),
    ([CALL], [*ASK_CALL, ("sam", "need to cancel tomorrow's call, something came up")], ("cancel", 1)),
    ([COFFEE], [ASK_COFFEE, ("manish", "nah I'm not free")], ("cancel", 1)),
    ([COFFEE, CALL], [*ASK_CALL, ASK_COFFEE, ("sam", "let's skip the call tomorrow")], ("cancel", 2)),
    ([COFFEE], [ASK_COFFEE, ("sam", "never mind about coffee")], ("cancel", 1)),
    # Personal reminders, alone with the assistant (one speaker) or in a shared chat
    ([], [ASK_MOM], ("remind", "2026-10-01 18:00")),
    ([], [("sam", "remind me tomorrow at 9 to send the deck")], ("remind", "2026-10-02 09:00")),
    ([], [("sam", "remind me in 20 minutes to check the oven")], ("remind", "2026-10-01 10:50")),
    ([], [("sam", "can you remind me to take my meds at 9 pm")], ("remind", "2026-10-01 21:00")),
    ([], [("sam", "remind me to call mom"), ("sam", "at 6 pm")], ("remind", "2026-10-01 18:00")),
    ([], [("manish", "mujhe kal subah 8 baje gym ke liye yaad dilana")], ("remind", "2026-10-02 08:00")),
    ([], [("manish", "how's the deck going?"), ("sam", "almost done, remind me to send it at 5")], ("remind", "2026-10-01 17:00")),
    ([COFFEE], [ASK_COFFEE, ("manish", "sure"), ("manish", "also remind me to book a cab at 3:30")], ("remind", "2026-10-01 15:30")),
    # Its owner changes or cancels it; others can't agree to it
    ([MOM], [ASK_MOM, ("sam", "actually make it 7")], ("change", 1, "2026-10-01 19:00")),
    ([MOM], [ASK_MOM, ("sam", "cancel that reminder")], ("cancel", 1)),
    ([COFFEE, MOM], [ASK_COFFEE, ASK_MOM, ("sam", "push my mom reminder to 8 pm")], ("change", 2, "2026-10-01 20:00")),
    ([MOM, COFFEE], [ASK_MOM, ASK_COFFEE, ("manish", "sure, see you at 4")], ("agree", 2)),
    ([MOM], [ASK_MOM, ("manish", "nice, say hi to her")], ("none",)),
    ([MOM], [ASK_MOM, ("sam", "thanks!")], ("none",)),
    # Not reminders
    ([], [("sam", "remind me what we said about the budget?")], ("none",)),
    ([], [("manish", "I'll remind him about the meeting")], ("none",)),
    ([], [("sam", "remind me later")], ("none",)),
    ([], [("sam", "that reminds me, did you pay the rent?")], ("none",)),
    # Groups: each person answers for themselves
    ([LUNCH], [*ASK_LUNCH, ("lee", "count me in too")], ("agree", 1)),
    ([LUNCH], [*ASK_LUNCH, ("lee", "can't make it, sorry")], ("cancel", 1)),
]


def got(d) -> tuple:
    when = d.when.strftime("%Y-%m-%d %H:%M") if d.when else None
    if d.action == "none":
        return ("none",)
    if d.action in ("propose", "remind"):
        return (d.action, when)
    if d.action == "change":
        return ("change", d.plan, when)
    return (d.action, d.plan)


async def run_case(i, plans, messages, expected, gate):
    lines = [
        Line(NOW - timedelta(minutes=len(messages) - 1 - n), name, text)
        for n, (name, text) in enumerate(messages)
    ]
    async with gate:
        try:
            actual = got(await decide(NOW, ZONE, plans, lines))
        except Exception as e:
            actual = ("error", f"{type(e).__name__}: {str(e)[:160]}")
    return i, messages[-1][1], expected, actual


async def main():
    gate = asyncio.Semaphore(1)  # Groq's rate limit rejects parallel bursts
    results = await asyncio.gather(
        *(run_case(i, *case, gate) for i, case in enumerate(CASES, 1))
    )
    passed = 0
    for i, text, expected, actual in results:
        ok = actual == expected
        passed += ok
        if not ok:
            print(f"FAIL #{i} {text!r}: expected {expected}, got {actual}")
    false_plans = sum(1 for _, _, e, a in results if e == ("none",) and a[0] not in ("none", "error"))
    print(f"\n{passed}/{len(results)} correct; {false_plans} non-plans were treated as plans")


if __name__ == "__main__":
    asyncio.run(main())
