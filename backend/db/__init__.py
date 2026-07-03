"""Database layer - split by table."""
from db.client import get_supabase_client
from db.lists import create_list, get_user_lists, get_list_by_id, update_list, delete_list
from db.list_members import add_list_member, get_list_members, update_member_role, remove_list_member
from db.invite_tokens import (
    create_invite_token,
    get_invite_token,
    get_invite_for_accept_rpc,
    accept_invite,
    list_invite_tokens,
    revoke_invite_token,
)
from db.getaways import (
    create_loading_getaway,
    insert_getaway,
    get_list_getaways,
    get_getaway_by_slug,
    update_getaway,
    update_getaway_by_slug,
    delete_getaway,
    delete_getaway_by_slug,
    insert_getaway_images,
)

__all__ = [
    "get_supabase_client",
    "create_list",
    "get_user_lists",
    "get_list_by_id",
    "update_list",
    "delete_list",
    "add_list_member",
    "get_list_members",
    "update_member_role",
    "remove_list_member",
    "create_invite_token",
    "get_invite_token",
    "get_invite_for_accept_rpc",
    "accept_invite",
    "list_invite_tokens",
    "revoke_invite_token",
    "create_loading_getaway",
    "insert_getaway",
    "get_list_getaways",
    "get_getaway_by_slug",
    "update_getaway",
    "update_getaway_by_slug",
    "delete_getaway",
    "delete_getaway_by_slug",
    "insert_getaway_images",
]
