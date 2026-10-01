"""
The Listener reads the newest message in a human conversation and says what it
does to the plans in that chat: proposes one, agrees to one, changes, cancels,
or nothing. It never touches the database; services/listener.py applies it.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from ..config.settings import settings


class ListenerDecision(BaseModel):
    action: Literal["none", "propose", "agree", "change", "cancel"]
    plan: Optional[int] = Field(
        default=None,
        description="Required for agree, change and cancel: the number of the pending plan (1, 2, ...).",
    )
    title: Optional[str] = Field(
        default=None,
        description="2 to 5 words naming the activity, without people's names, e.g. 'Coffee' or 'Project call'.",
    )
    when: Optional[datetime] = Field(
        default=None,
        description="Local date and time of the plan, YYYY-MM-DDTHH:MM, in the same time zone as 'Now'. No offset.",
    )


@dataclass
class Line:
    at: datetime  # local time of the reader
    name: str
    text: str


@dataclass
class Plan:
    title: str
    at: datetime  # local time of the reader
    proposer: str
    agreed: bool


PROMPT = """\
You watch a chat between people and keep track of plans to meet, call or do something together at a specific time.
Decide what the NEWEST message does. Earlier messages are only context. Pick exactly one action:

- propose: suggests a new plan with a time you can pin down ("let's meet at 4 pm today", "call tomorrow at 10?"). Give title and when.
- agree: accepts a pending plan that SOMEONE ELSE proposed ("sure", "sounds good", "see you then", "yes 4 works"). Give plan.
- change: moves or edits a pending plan ("can we make it 5 instead?", "let's do Friday at 6 instead"). Give plan, plus when and/or title.
- cancel: declines or calls off a pending plan ("can't make it", "let's skip it"). Give plan.

For agree, change and cancel, always set plan to that plan's number from the "Pending plans" list, even when there is only one.
- none: anything else: small talk, past events, plans with no time ("we should hang out sometime"), or someone repeating their own plan.

Times:
- "today", "tomorrow" and weekdays count from Now. A clock time with no day means the next time that clock time comes.
- Parts of the day: morning 09:00, noon 12:00, afternoon 15:00, evening 18:00, tonight 20:00.
- A day with no time at all ("let's meet Friday") is not a plan yet: none.
- "in 2 hours" counts from Now.
- If the newest message restates a pending plan from someone else, that is agree. A new time for a pending plan is change, not propose.
"""

listener_agent = Agent(
    GroqModel(
        model_name="openai/gpt-oss-120b",
        provider=GroqProvider(api_key=settings.GROQ_API_KEY),
    ),
    system_prompt=PROMPT,
    output_type=ListenerDecision,
    output_retries=3,  # the model occasionally sends a malformed reply
    model_settings={"temperature": 0},
)


def _clock(at: datetime) -> str:
    return at.strftime("%a %Y-%m-%d %H:%M")


def render(now: datetime, zone: str, plans: list[Plan], lines: list[Line]) -> str:
    """The context the model sees. Every time is in the newest sender's zone."""
    out = [f"Now: {now.strftime('%A %Y-%m-%d %H:%M')} ({zone})", "", "Pending plans:"]
    for i, p in enumerate(plans, 1):
        state = "agreed" if p.agreed else "waiting for agreement"
        out.append(f"{i}. \"{p.title}\" at {_clock(p.at)}, proposed by {p.proposer}, {state}")
    if not plans:
        out.append("(none)")
    out += ["", "Messages, oldest first:"]
    out += [f"[{_clock(l.at)}] {l.name}: {l.text}" for l in lines]
    out.append(f"\nThe newest message is the last one, from {lines[-1].name}.")
    return "\n".join(out)


async def decide(now: datetime, zone: str, plans: list[Plan], lines: list[Line]) -> ListenerDecision:
    result = await listener_agent.run(render(now, zone, plans, lines))
    return result.output
