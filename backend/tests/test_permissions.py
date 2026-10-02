"""
Tests for who may see, write in, and remove people from a conversation.
"""

import uuid

from sqlmodel import Session

from app.models.chats import Conversation, ConversationParticipant
from app.models.user import User
from app.services.permissions import ConversationPermissions as P


def test_who_can_see_write_and_remove(engine):
    owner, member, left, outsider = (uuid.uuid4() for _ in range(4))
    convo, public = uuid.uuid4(), uuid.uuid4()
    with Session(engine) as s:
        s.add_all([User(id=u, email=f"{u}@x.io") for u in (owner, member, left, outsider)])
        s.add_all([
            Conversation(id=convo, owner_id=owner),
            Conversation(id=public, owner_id=owner, is_public=True),
            ConversationParticipant(conversation_id=convo, user_id=owner, role="owner"),
            ConversationParticipant(conversation_id=convo, user_id=member),
            ConversationParticipant(conversation_id=convo, user_id=left, is_active=False),
        ])
        s.commit()

        assert P.can_view(s, convo, owner) and P.can_view(s, convo, member)
        assert not P.can_view(s, convo, left) and not P.can_view(s, convo, outsider)
        assert not P.can_view(s, uuid.uuid4(), owner)  # no such conversation

        assert P.can_send_message(s, convo, member) and P.can_invite(s, convo, member)
        assert not P.can_send_message(s, convo, left) and not P.can_invite(s, convo, outsider)

        # Anyone can read a public conversation, but only members write in it
        assert P.can_view(s, public, outsider) and not P.can_send_message(s, public, outsider)

        assert P.can_remove(s, convo, member, member)  # leave yourself
        assert P.can_remove(s, convo, owner, member)  # the owner removes others
        assert not P.can_remove(s, convo, member, owner)
        assert P.is_owner(s, convo, owner) and not P.is_owner(s, convo, member)
