"""
Conversation permissions and access control
"""

import uuid
from sqlmodel import Session, select
from app.models.chats import Conversation, ConversationParticipant


class ConversationPermissions:
    """Handles access control for conversations"""

    @staticmethod
    def can_view(
        session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Can user view this conversation?"""
        # Check if conversation exists
        conversation = session.exec(
            select(Conversation).where(Conversation.id == conversation_id)
        ).first()

        if not conversation:
            return False

        # Public conversations can be viewed by anyone
        if conversation.is_public:
            return True

        # Check if user is a participant
        participant = session.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
        ).first()

        return participant is not None

    @staticmethod
    def can_send_message(
        session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Can user send messages? (all active participants can)"""
        participant = session.exec(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
            )
        ).first()

        return participant is not None

    @staticmethod
    def can_invite(
        session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Can user invite others? (all participants can)"""
        return ConversationPermissions.can_send_message(
            session, conversation_id, user_id
        )

    @staticmethod
    def can_remove(
        session: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        target_user_id: uuid.UUID,
    ) -> bool:
        """Can user remove another participant?"""
        # Users can always remove themselves
        if user_id == target_user_id:
            return True

        # Check if user is the owner
        conversation = session.exec(
            select(Conversation).where(Conversation.id == conversation_id)
        ).first()

        if not conversation:
            return False

        return conversation.owner_id == user_id

    @staticmethod
    def can_transfer_ownership(
        session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Can user transfer ownership? (only current owner)"""
        conversation = session.exec(
            select(Conversation).where(Conversation.id == conversation_id)
        ).first()

        if not conversation:
            return False

        return conversation.owner_id == user_id

    @staticmethod
    def is_owner(
        session: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Check if user is the conversation owner"""
        conversation = session.exec(
            select(Conversation).where(Conversation.id == conversation_id)
        ).first()

        if not conversation:
            return False

        return conversation.owner_id == user_id
