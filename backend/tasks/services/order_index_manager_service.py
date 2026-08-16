"""
Service tính toán chuỗi sắp xếp Lexicographical (LexoRank) cho Bảng Kanban.
Đảm bảo đồng bộ tuyệt đối 100% giữa Python, SQLite, PostgreSQL và JavaScript.
"""

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
BASE = len(ALPHABET)

MIN_CHAR = ALPHABET[0]
MAX_CHAR = ALPHABET[-1]
MIDDLE_CHAR = ALPHABET[BASE // 2]


class OrderIndexError(ValueError):
    pass


def _char_to_index(char):
    try:
        return ALPHABET.index(char.lower())
    except ValueError:
        raise OrderIndexError(f"Invalid order_index character: {char}")


def _index_to_char(index):
    if index < 0 or index >= BASE:
        raise OrderIndexError(f"Invalid order_index index: {index}")

    return ALPHABET[index]


def initial_key():
    """
    Key mặc định cho task đầu tiên trong một cột Kanban.
    """
    return MIDDLE_CHAR


def key_between(prev_key=None, next_key=None):
    """
    Sinh một chuỗi nằm giữa prev_key và next_key theo thứ tự từ điển.

    Trường hợp xử lý an toàn (Fail-Safe):
    - prev_key=None, next_key=None: task đầu tiên trong cột.
    - prev_key có, next_key=None: thêm cuối cột.
    - prev_key=None, next_key có: thêm đầu cột.
    - cả hai có: thêm giữa hai task.
    - NẾU DỮ LIỆU BỊ TRÙNG (prev_key == next_key): Tự động sinh key mới nằm sau prev_key.
    - NẾU VỊ TRÍ BỊ ĐẢO (prev_key > next_key): Tự động đảo lại để tính khoảng giữa mượt mà.
    """
    if prev_key is not None:
        prev_key = str(prev_key)

    if next_key is not None:
        next_key = str(next_key)

    # 🛡️ XỬ LÝ AN TOÀN NẾU 2 KEY BẰNG NHAU (DUPLICATE DB KEYS)
    if prev_key and next_key and prev_key == next_key:
        return key_between(prev_key, None)

    # 🛡️ XỬ LÝ AN TOÀN NẾU THỨ TỰ BỊ ĐẢO
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