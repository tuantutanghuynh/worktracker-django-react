"""
Module: tasks.services.order_index_manager_service
Description: Service computing lexicographical order ranks for Kanban board drag-and-drop operations.
"""

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
BASE = len(ALPHABET)

MIN_CHAR = ALPHABET[0]
MAX_CHAR = ALPHABET[-1]
MIDDLE_CHAR = ALPHABET[BASE // 2]


class OrderIndexError(ValueError):
    """Exception indicating invalid characters or indices during lexicographical ordering calculations."""
    pass


def _char_to_index(char):
    """Return numeric integer index of character within base alphabet."""
    try:
        return ALPHABET.index(char.lower())
    except ValueError:
        raise OrderIndexError(f"Invalid order_index character: {char}")


def _index_to_char(index):
    """Return character corresponding to numeric alphabet index."""
    if index < 0 or index >= BASE:
        raise OrderIndexError(f"Invalid order_index index: {index}")

    return ALPHABET[index]


def initial_key():
    """Return initial default middle key for first task in Kanban column."""
    return MIDDLE_CHAR


def key_between(prev_key=None, next_key=None):
    """Generate lexicographical sort key string positioned between previous and next keys."""
    if prev_key is not None:
        prev_key = str(prev_key)

    if next_key is not None:
        next_key = str(next_key)

    if prev_key and next_key and prev_key == next_key:
        return key_between(prev_key, None)

    if prev_key and next_key and prev_key > next_key:
        prev_key, next_key = next_key, prev_key

    if prev_key is None and next_key is None:
        return initial_key()

    prefix = ""
    index = 0

    while True:
        prev_digit = (
            _char_to_index(prev_key[index])
            if prev_key is not None and index < len(prev_key)
            else 0
        )

        next_digit = (
            _char_to_index(next_key[index])
            if next_key is not None and index < len(next_key)
            else BASE - 1
        )

        if next_digit - prev_digit > 1:
            middle_digit = (prev_digit + next_digit) // 2
            return prefix + _index_to_char(middle_digit)

        prefix += _index_to_char(prev_digit)
        index += 1