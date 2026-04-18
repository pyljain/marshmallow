import lancedb
db = lancedb.connect("marshmallow.lancedb")
table = db.open_table("kb_2")

results = table.search("shekhar").to_list()
for result in results:
    print("-------------")
    print(result['content'])
    print("-------------")